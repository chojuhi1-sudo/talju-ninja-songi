import {
  COURSE_BOUNDS,
  PHYSICS_CONFIG,
  SCORE_CONFIG,
  STAGE_CONFIGS,
} from './config';
import {
  PlatformDef,
  PlayerPhysicsState,
  RingDef,
  SnowflakeDef,
  StageConfig,
  StageId,
  StepEvents,
} from './types';

export interface ActionInputStep {
  justPressed: boolean;
  held: boolean;
  justReleased: boolean;
}

export function createPlayerState(
  startX: number,
  startY: number,
  initialSpeed: number = PHYSICS_CONFIG.baseRunSpeed
): PlayerPhysicsState {
  return {
    x: startX,
    y: startY,
    prevX: startX,
    prevY: startY,
    vx: initialSpeed,
    vy: 0,
    onGround: true,
    coyoteTimer: PHYSICS_CONFIG.coyoteTimeSec,
    jumpBufferTimer: 0,
    hasJumpedSinceGrounded: false,
    isSwinging: false,
    attachedRingId: null,
    attachedRingX: 0,
    attachedRingY: 0,
    ropeLength: 0,
    lastDetachedRingId: null,
    landingSquash: 0,
    jumpStretch: 0,
    strideDistance: 0,
    isDead: false,
    landedOnArrival: false,
  };
}

export function getStageForX(x: number): StageConfig {
  if (x < COURSE_BOUNDS.stage1EndX) return STAGE_CONFIGS[0];
  if (x < COURSE_BOUNDS.stage2EndX) return STAGE_CONFIGS[1];
  return STAGE_CONFIGS[2];
}

export function getStageIdForX(x: number): StageId {
  return getStageForX(x).id;
}

export function getTargetGroundSpeed(x: number, isTutorial: boolean): number {
  if (isTutorial) {
    return PHYSICS_CONFIG.tutorialRunSpeed;
  }
  const stage = getStageForX(x);
  const span = Math.max(1, stage.endX - stage.startX);
  const t = Math.max(0, Math.min(1, (x - stage.startX) / span));
  return stage.startSpeed + (stage.endSpeed - stage.startSpeed) * t;
}

/**
 * Computes exact normalized full-course progress [0..1] strictly from world X coordinates
 * (never camera X, screen X, or elapsed time).
 */
export function computeCourseProgress(
  playerWorldX: number,
  startX: number,
  arrivalStartX: number,
  isCleared = false
): number {
  if (isCleared) return 1;
  const span = Math.max(1, arrivalStartX - startX);
  return Math.max(0, Math.min(1, (playerWorldX - startX) / span));
}

export function getGrappleOrigin(player: Pick<PlayerPhysicsState, 'x' | 'y'>): {
  x: number;
  y: number;
} {
  return {
    x: player.x + PHYSICS_CONFIG.grappleOriginOffsetX,
    y: player.y + PHYSICS_CONFIG.grappleOriginOffsetY,
  };
}

/**
 * Checks whether a grapple ring is a valid connection candidate:
 * - Strictly above Songi's grapple origin (ring.y < origin.y - 16)
 * - Strictly in front of both Songi's body AND grapple hand (ring.x >= origin.x, never behind!)
 * - Within maxWireRange (475px)
 * - Not the ring currently attached or immediately just released in the same jump chain
 */
export function isRingValidCandidate(
  player: Pick<
    PlayerPhysicsState,
    'x' | 'y' | 'attachedRingId' | 'lastDetachedRingId'
  >,
  ring: RingDef,
  maxRange: number = PHYSICS_CONFIG.maxWireRange
): boolean {
  if (ring.id === player.attachedRingId) return false;
  if (ring.id === player.lastDetachedRingId) return false;

  const origin = getGrappleOrigin(player);
  // Ring must be strictly above grapple origin and strictly forward (never behind player or hand)
  if (ring.y >= origin.y - 16) return false;
  if (ring.x < origin.x || ring.x <= player.x + 18) return false;

  const dx = ring.x - origin.x;
  const dy = ring.y - origin.y;
  const distSq = dx * dx + dy * dy;
  return distSq <= maxRange * maxRange && distSq >= 38 * 38;
}

export function findValidRings(
  player: Pick<
    PlayerPhysicsState,
    'x' | 'y' | 'attachedRingId' | 'lastDetachedRingId'
  >,
  rings: readonly RingDef[],
  maxRange: number = PHYSICS_CONFIG.maxWireRange
): RingDef[] {
  const result: RingDef[] = [];
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (r.x < player.x || r.x - player.x > maxRange + 80) continue;
    if (isRingValidCandidate(player, r, maxRange)) {
      result.push(r);
    }
  }
  return result;
}

/**
 * Deterministically selects the best valid grapple ring based on forward angle (~43 deg) and distance.
 * Never selects a ring behind the player.
 */
export function selectBestRing(
  player: Pick<
    PlayerPhysicsState,
    'x' | 'y' | 'attachedRingId' | 'lastDetachedRingId'
  >,
  rings: readonly RingDef[],
  maxRange: number = PHYSICS_CONFIG.maxWireRange
): RingDef | null {
  const origin = getGrappleOrigin(player);
  let best: RingDef | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const idealAngle = Math.PI * 0.24; // ~43 deg ahead and upward

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.x < origin.x || ring.x - player.x > maxRange + 80) continue;
    if (!isRingValidCandidate(player, ring, maxRange)) continue;

    const dx = ring.x - origin.x; // >= 0 guaranteed
    const dy = origin.y - ring.y; // > 16 upward guaranteed
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angle - idealAngle);
    const score = dist + angleDiff * 145;

    if (score < bestScore) {
      bestScore = score;
      best = ring;
    }
  }

  return best;
}

/**
 * Executes one fixed-timestep (e.g. 1/120s) simulation update for Songi.
 */
export function stepPlayerPhysics(
  player: PlayerPhysicsState,
  dt: number,
  input: ActionInputStep,
  platforms: readonly PlatformDef[],
  rings: readonly RingDef[],
  isTutorial: boolean
): StepEvents {
  const events: StepEvents = {
    jumped: false,
    landed: false,
    landingImpactVy: 0,
    wireAttached: false,
    wireDetached: false,
    attachedRing: null,
    fellOut: false,
    reachedArrival: false,
  };

  if (player.isDead) {
    return events;
  }

  player.prevX = player.x;
  player.prevY = player.y;

  // Decay purely visual squash/stretch
  player.landingSquash = Math.max(0, player.landingSquash - dt * 6.5);
  player.jumpStretch = Math.max(0, player.jumpStretch - dt * 5.5);

  // Update coyote & jump buffer timers
  if (player.onGround) {
    player.coyoteTimer = PHYSICS_CONFIG.coyoteTimeSec;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }
  if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  }

  const canGroundJump =
    !player.isSwinging &&
    !player.hasJumpedSinceGrounded &&
    (player.onGround || player.coyoteTimer > 0);

  let pressConsumedThisStep = false;

  // 1. Handle fresh press: Ground/Coyote Jump FIRST; otherwise Airborne Wire Grapple or Jump Buffer
  if (input.justPressed) {
    if (canGroundJump) {
      performJump(player);
      events.jumped = true;
      pressConsumedThisStep = true;
    } else if (!player.isSwinging && !player.onGround) {
      // Airborne secondary press: attempt wire connection to a valid overhead forward ring
      const targetRing = selectBestRing(player, rings);
      if (targetRing) {
        attachToRing(player, targetRing);
        events.wireAttached = true;
        events.attachedRing = targetRing;
        player.jumpBufferTimer = 0;
        pressConsumedThisStep = true;
      } else {
        // No ring in range — buffer jump in case Songi is ~100ms away from landing on a platform
        player.jumpBufferTimer = PHYSICS_CONFIG.jumpBufferSec;
      }
    }
  }

  // Execute buffered jump if grounded and not consumed by wire
  if (
    !pressConsumedThisStep &&
    player.jumpBufferTimer > 0 &&
    !player.isSwinging &&
    !player.hasJumpedSinceGrounded &&
    (player.onGround || player.coyoteTimer > 0)
  ) {
    performJump(player);
    events.jumped = true;
    player.jumpBufferTimer = 0;
  }

  // 2. Handle wire release when action input is released
  if (player.isSwinging && (!input.held || input.justReleased)) {
    detachFromRing(player);
    events.wireDetached = true;
  }

  const targetSpeed = getTargetGroundSpeed(player.x, isTutorial);

  // 3. Integrate motion according to current state (Swinging Pendulum vs Free/Ground Motion)
  if (player.isSwinging) {
    stepPendulumMotion(player, dt);
  } else {
    if (player.onGround) {
      // Smoothly recover horizontal velocity toward target stage ground speed
      const blend = Math.min(1, PHYSICS_CONFIG.groundRecoverRate * dt);
      player.vx += (targetSpeed - player.vx) * blend;
      player.vy = 0;
      player.x += player.vx * dt;
      player.strideDistance += Math.abs(player.vx) * dt;

      // Verify whether Songi is still supported by a platform at her current X
      const halfW = PHYSICS_CONFIG.colliderWidth * 0.45;
      let supportingPlatform: PlatformDef | null = null;
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (
          player.x + halfW >= p.x &&
          player.x - halfW <= p.x + p.width &&
          Math.abs(player.y - p.y) <= 2.5
        ) {
          supportingPlatform = p;
          break;
        }
      }

      if (!supportingPlatform) {
        player.onGround = false;
      } else {
        player.y = supportingPlatform.y;
        if (supportingPlatform.isArrival && !player.landedOnArrival) {
          player.landedOnArrival = true;
          events.reachedArrival = true;
        }
      }
    } else {
      // Free flight in air: preserve current horizontal momentum (from jump or wire release)
      player.vy += PHYSICS_CONFIG.gravity * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }
  }

  // 4. Swept one-way top-surface platform collision when descending (never snaps upward!)
  if (!player.onGround && player.vy >= 0) {
    const halfW = PHYSICS_CONFIG.colliderWidth * 0.45;
    let landedPlatform: PlatformDef | null = null;
    let earliestTopY = Number.POSITIVE_INFINITY;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      // Horizontal overlap check at swept X
      if (player.x + halfW < p.x || player.x - halfW > p.x + p.width) {
        continue;
      }
      // Foot crossed platform top surface from above (with tiny 2px tolerance for grazing contact)
      if (player.prevY <= p.y + 2 && player.y >= p.y) {
        if (p.y < earliestTopY) {
          earliestTopY = p.y;
          landedPlatform = p;
        }
      }
    }

    if (landedPlatform) {
      if (player.isSwinging) {
        detachFromRing(player);
        events.wireDetached = true;
      }
      const impactVy = player.vy;
      player.y = landedPlatform.y;
      player.vy = 0;
      player.onGround = true;
      player.hasJumpedSinceGrounded = false;
      player.lastDetachedRingId = null;
      player.coyoteTimer = PHYSICS_CONFIG.coyoteTimeSec;
      player.landingSquash = Math.min(1, Math.max(0.25, impactVy / 850));

      events.landed = true;
      events.landingImpactVy = impactVy;

      if (landedPlatform.isArrival && !player.landedOnArrival) {
        player.landedOnArrival = true;
        events.reachedArrival = true;
      }

      // If player buffered a jump right before touching down, fire it cleanly on next check
      if (player.jumpBufferTimer > 0) {
        // Ensure horizontal speed gently blends toward at least ground speed if slower
        if (player.vx < targetSpeed * 0.85) {
          player.vx = targetSpeed * 0.92;
        }
        performJump(player);
        player.jumpBufferTimer = 0;
        events.jumped = true;
      }
    }
  }

  // 5. Fall boundary check
  if (player.y > PHYSICS_CONFIG.fallDeathY) {
    if (player.isSwinging) {
      detachFromRing(player);
    }
    player.isDead = true;
    events.fellOut = true;
  }

  return events;
}

function performJump(player: PlayerPhysicsState): void {
  player.vy = PHYSICS_CONFIG.jumpVelocity;
  player.onGround = false;
  player.coyoteTimer = 0;
  player.hasJumpedSinceGrounded = true;
  player.jumpStretch = 0.85;
  player.landingSquash = 0;
}

function attachToRing(player: PlayerPhysicsState, ring: RingDef): void {
  const origin = getGrappleOrigin(player);
  const dx = origin.x - ring.x;
  const dy = origin.y - ring.y;
  const rawDist = Math.hypot(dx, dy);

  player.isSwinging = true;
  player.onGround = false;
  player.attachedRingId = ring.id;
  player.attachedRingX = ring.x;
  player.attachedRingY = ring.y;
  player.ropeLength = Math.max(
    PHYSICS_CONFIG.minRopeLength,
    Math.min(PHYSICS_CONFIG.maxWireRange, rawDist)
  );

  // Project velocity onto tangent at connection distance so pendulum swing starts smoothly without slack snap
  if (rawDist > 1e-4) {
    const ux = dx / rawDist;
    const uy = dy / rawDist;
    // Counter-clockwise tangent (left-down-right-up)
    const tx = uy;
    const ty = -ux;
    const vt = player.vx * tx + player.vy * ty;
    const initialVt = Math.max(vt, player.vx * 0.82);
    player.vx = tx * initialVt;
    player.vy = ty * initialVt;
  }
}

function detachFromRing(player: PlayerPhysicsState): void {
  if (!player.isSwinging) return;
  player.lastDetachedRingId = player.attachedRingId;
  player.isSwinging = false;
  player.attachedRingId = null;
  // Exact current position (x, y) and tangential velocity (vx, vy) are preserved untouched!
}

/**
 * True 2D constraint pendulum motion around the attached grapple ring:
 * - Applies gravity and gentle swing kick along forward arc below ring
 * - Enforces distance constraint ONLY when taut (dist >= ropeLength)
 * - Projects out outward radial velocity to preserve tangential pendulum motion
 */
function stepPendulumMotion(player: PlayerPhysicsState, dt: number): void {
  // Apply gravity
  player.vy += PHYSICS_CONFIG.gravity * dt;

  const preOrigin = getGrappleOrigin(player);
  const preDx = preOrigin.x - player.attachedRingX;
  const preDy = preOrigin.y - player.attachedRingY;
  const preDist = Math.hypot(preDx, preDy);

  // Subtle forward ninja swing pump while swinging forward underneath the ring
  if (preDist > 1e-4 && preDy > 15) {
    const ux = preDx / preDist;
    const uy = preDy / preDist;
    const tx = uy;
    const ty = -ux;
    const vt = player.vx * tx + player.vy * ty;
    if (vt >= -20 && vt < PHYSICS_CONFIG.maxSwingSpeed) {
      player.vx += tx * PHYSICS_CONFIG.swingPumpAccel * dt;
      player.vy += ty * PHYSICS_CONFIG.swingPumpAccel * dt;
    }
  }

  // Integrate candidate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Check rope distance from grapple hand origin to ring
  const origin = getGrappleOrigin(player);
  const dx = origin.x - player.attachedRingX;
  const dy = origin.y - player.attachedRingY;
  const dist = Math.hypot(dx, dy);

  // Enforce taut rope constraint when distance reaches or exceeds ropeLength
  if (dist >= player.ropeLength && dist > 1e-4) {
    const ux = dx / dist;
    const uy = dy / dist;

    // Constrain grapple origin onto circle of radius ropeLength
    const constrainedOriginX = player.attachedRingX + ux * player.ropeLength;
    const constrainedOriginY = player.attachedRingY + uy * player.ropeLength;

    player.x = constrainedOriginX - PHYSICS_CONFIG.grappleOriginOffsetX;
    player.y = constrainedOriginY - PHYSICS_CONFIG.grappleOriginOffsetY;

    // Remove outward radial velocity component while preserving tangential velocity
    const vr = player.vx * ux + player.vy * uy;
    if (vr > 0) {
      player.vx -= vr * ux;
      player.vy -= vr * uy;
    }

    // Slight natural air damping so infinite holding gently settles
    player.vx *= 0.9994;
    player.vy *= 0.9994;
  }
}

export function collectSnowflakesInStep(
  player: Pick<PlayerPhysicsState, 'x' | 'y' | 'prevX' | 'prevY'>,
  snowflakes: SnowflakeDef[]
): SnowflakeDef[] {
  const collectedNow: SnowflakeDef[] = [];
  const currCy = player.y + PHYSICS_CONFIG.collectCenterOffsetY;
  const prevCy = player.prevY + PHYSICS_CONFIG.collectCenterOffsetY;
  const midX = (player.x + player.prevX) * 0.5;
  const midY = (currCy + prevCy) * 0.5;

  for (let i = 0; i < snowflakes.length; i++) {
    const sf = snowflakes[i];
    if (sf.collected) continue;
    if (Math.abs(sf.x - player.x) > 95) continue;

    const r =
      sf.kind === 'golden'
        ? PHYSICS_CONFIG.collectRadiusGolden
        : PHYSICS_CONFIG.collectRadiusNormal;
    const rSq = r * r;

    const dx1 = sf.x - player.x;
    const dy1 = sf.y - currCy;
    const dx2 = sf.x - midX;
    const dy2 = sf.y - midY;

    if (dx1 * dx1 + dy1 * dy1 <= rSq || dx2 * dx2 + dy2 * dy2 <= rSq) {
      sf.collected = true;
      collectedNow.push(sf);
    }
  }

  return collectedNow;
}

export function calculateScores(
  startX: number,
  currentX: number,
  normalCount: number,
  goldenCount: number
): {
  distanceMeters: number;
  distanceScore: number;
  snowflakeScore: number;
  totalScore: number;
} {
  const rawPx = Math.max(0, currentX - startX);
  const distanceMeters = Math.floor(rawPx / SCORE_CONFIG.pxPerMeter);
  const distanceScore = distanceMeters; // 1m = 1pt
  const snowflakeScore =
    normalCount * SCORE_CONFIG.normalSnowflakePoints +
    goldenCount * SCORE_CONFIG.goldenSnowflakePoints;
  return {
    distanceMeters,
    distanceScore,
    snowflakeScore,
    totalScore: distanceScore + snowflakeScore,
  };
}

export interface AirborneFailureTelemetry {
  jumpedFromGround: boolean;
  attachedRingCount: number;
  lastReleaseDx: number | null;
  lastReleaseVy: number | null;
  wasSwingingOrStalledBackward: boolean;
  sawValidUnattachedRingAfterRelease: boolean;
  hasSubsequentChasmRingAhead: boolean;
  chasmHadInitialOverheadRing: boolean;
}

/**
 * Produces a concise, non-presumptuous failure hint ONLY when the airborne telemetry
 * unambiguously identifies why Songi fell. Returns null if uncertain.
 */
export function analyzeFailureHint(
  t: AirborneFailureTelemetry
): string | null {
  // 1. Never attached a wire despite falling into a chasm equipped with an overhead ring
  if (t.attachedRingCount === 0 && t.chasmHadInitialOverheadRing) {
    if (!t.jumpedFromGround) {
      return '발판 끝에서 먼저 점프한 뒤 공중에서 와이어를 걸어 보세요.';
    }
    return '점프 후 공중에서 다시 길게 눌러 빛나는 고리에 연결해 보세요.';
  }

  // 2. Attached at least one ring, and another required ring existed in the same chasm
  if (
    t.attachedRingCount >= 1 &&
    (t.sawValidUnattachedRingAfterRelease || t.hasSubsequentChasmRingAhead)
  ) {
    if (t.wasSwingingOrStalledBackward) {
      return '고리 앞쪽으로 솟구칠 때 손을 뗀 뒤 다음 고리로 다시 연결해 보세요.';
    }
    if (t.lastReleaseVy !== null && t.lastReleaseVy > -35) {
      return '와이어를 조금 더 늦게 놓아 높이를 확보한 뒤 다음 고리로 연결해 보세요.';
    }
    return '손을 뗀 뒤 공중에서 다시 눌러 다음 고리로 연결해 보세요.';
  }

  // 3. Held wire without releasing (stalled & swung backward into pit)
  if (t.attachedRingCount >= 1 && t.wasSwingingOrStalledBackward) {
    return '와이어를 계속 쥐지 말고 앞으로 솟구칠 때 손을 떼어 보세요.';
  }

  // 4. Released wire too early (still moving downward or flat before forward upswing)
  if (
    t.attachedRingCount >= 1 &&
    t.lastReleaseVy !== null &&
    t.lastReleaseVy > -55 &&
    (t.lastReleaseDx === null || t.lastReleaseDx < 115)
  ) {
    return '와이어를 조금 더 늦게 놓아 앞쪽 상승 탄력을 받아 보세요.';
  }

  // Ambiguous cause (e.g. slight jump mistiming on normal gap) — do not fabricate a definitive hint
  return null;
}

