import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import zlib from 'node:zlib';
import { COURSE_BOUNDS, PHYSICS_CONFIG, SPRITE_CONFIG } from './config';
import { buildMainCourse, buildTutorialCourse } from './courses';
import {
  ActionInputStep,
  analyzeFailureHint,
  calculateScores,
  collectSnowflakesInStep,
  computeCourseProgress,
  createPlayerState,
  getTargetGroundSpeed,
  selectBestRing,
  stepPlayerPhysics,
} from './physics';
import {
  findContentBoundsRgba,
  removeOuterWhiteFromCellRgba,
} from './spriteProcessor';
import { ChallengeClusterDef, CourseData } from './types';

function decodePngRgba(filePath: string): {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
} {
  const buf = fs.readFileSync(filePath);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idats: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const fullRgba = new Uint8ClampedArray(width * height * 4);
  let rpos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rpos++];
    for (let x = 0; x < stride; x++) {
      let val = raw[rpos++];
      const px = Math.floor(x / bpp);
      const ch = x % bpp;
      const a = x >= bpp ? fullRgba[y * width * 4 + (px - 1) * 4 + ch] : 0;
      const b = y > 0 ? fullRgba[(y - 1) * width * 4 + px * 4 + ch] : 0;
      const c =
        x >= bpp && y > 0
          ? fullRgba[(y - 1) * width * 4 + (px - 1) * 4 + ch]
          : 0;
      if (filter === 1) val = (val + a) & 255;
      else if (filter === 2) val = (val + b) & 255;
      else if (filter === 3) val = (val + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (val + pr) & 255;
      }
      fullRgba[y * width * 4 + px * 4 + ch] = val;
      if (bpp === 3 && ch === 2) {
        fullRgba[y * width * 4 + px * 4 + 3] = 255;
      }
    }
  }
  return { width, height, rgba: fullRgba };
}

/**
 * Simulates a discrete human-input player navigating `course` from `(spawnX, spawnY)`
 * until reaching `goalX` on ground or falling out, using ONLY legal discrete press/hold/release inputs.
 */
function simulatePlaySegment(
  course: CourseData,
  opts: {
    spawnX: number;
    spawnY: number;
    goalX: number;
    maxRingsPerAirborne?: number;
    releaseDxThreshold?: number;
    releaseVyThreshold?: number;
    holdForeverOnWire?: boolean;
    disableWire?: boolean;
    maxSeconds?: number;
  }
): {
  cleared: boolean;
  elapsedSec: number;
  finalX: number;
  landedPlatIds: string[];
  attachedRingIds: string[];
  collectedGolden: number;
  maxAttachSightDistance: number;
} {
  const isTutorial = course.mode === 'tutorial';
  const startSpeed = getTargetGroundSpeed(opts.spawnX, isTutorial);
  const p = createPlayerState(opts.spawnX, opts.spawnY, startSpeed);
  const dt = PHYSICS_CONFIG.fixedDt;
  const maxSteps = Math.round((opts.maxSeconds ?? 150) / dt);

  const releaseDx = opts.releaseDxThreshold ?? 126;
  const releaseVy = opts.releaseVyThreshold ?? -185;
  const maxRingsInAir = opts.maxRingsPerAirborne ?? 99;

  let held: boolean = false;
  let holdSteps = 0;
  let cooldownSteps = 0;
  let ringsUsedThisAir = 0;

  const landedPlatIds: string[] = [];
  const attachedRingIds: string[] = [];
  let collectedGolden = 0;
  let maxAttachSightDistance = 0;

  // Clone snowflakes so segment tests don't mutate shared course state
  const localSnowflakes = course.snowflakes.map((sf) => ({ ...sf }));

  for (let step = 0; step < maxSteps; step++) {
    let wantHold: boolean = held;
    if (cooldownSteps > 0) cooldownSteps--;

    if (p.onGround) {
      ringsUsedThisAir = 0;
      const curPlat = course.platforms.find(
        (pl) =>
          p.x + 20 >= pl.x &&
          p.x - 20 <= pl.x + pl.width &&
          Math.abs(p.y - pl.y) < 5
      );
      if (curPlat && !curPlat.isArrival) {
        const distToEdge = curPlat.x + curPlat.width - p.x;
        if (distToEdge <= 40 && !held) {
          wantHold = true;
          holdSteps = 4;
        }
      } else {
        wantHold = false;
      }
    } else if (p.isSwinging) {
      if (opts.holdForeverOnWire) {
        wantHold = true;
      } else {
        const dx = p.x - p.attachedRingX;
        if (dx >= releaseDx && p.vy <= releaseVy) {
          wantHold = false;
          cooldownSteps = 14; // ~0.115s human re-press interval
        } else {
          wantHold = true;
        }
      }
    } else {
      if (holdSteps > 0) {
        holdSteps--;
        wantHold = holdSteps > 0;
      } else {
        wantHold = false;
        if (!opts.disableWire && ringsUsedThisAir < maxRingsInAir) {
          const hasFloorSoon = course.platforms.some(
            (pl) =>
              p.x + 170 >= pl.x &&
              p.x + 15 <= pl.x + pl.width &&
              pl.y >= p.y - 22
          );
          if (!hasFloorSoon && cooldownSteps === 0 && p.vy >= -340) {
            const ring = selectBestRing(p, course.rings);
            if (ring && ring.x - p.x < 305) {
              wantHold = true;
            }
          }
        }
      }
    }

    const input: ActionInputStep = {
      justPressed: !held && wantHold,
      held: wantHold,
      justReleased: held && !wantHold,
    };
    held = wantHold;

    const preAttachX = p.x;
    const ev = stepPlayerPhysics(
      p,
      dt,
      input,
      course.platforms,
      course.rings,
      isTutorial
    );

    if (ev.wireAttached && ev.attachedRing) {
      ringsUsedThisAir++;
      attachedRingIds.push(ev.attachedRing.id);
      const sightDist = ev.attachedRing.x - preAttachX;
      if (sightDist > maxAttachSightDistance) {
        maxAttachSightDistance = sightDist;
      }
    }

    if (ev.landed) {
      const landed = course.platforms.find(
        (pl) =>
          p.x + 22 >= pl.x &&
          p.x - 22 <= pl.x + pl.width &&
          Math.abs(p.y - pl.y) < 3
      );
      if (landed && !landedPlatIds.includes(landed.id)) {
        landedPlatIds.push(landed.id);
      }
    }

    const got = collectSnowflakesInStep(p, localSnowflakes);
    for (const sf of got) {
      if (sf.kind === 'golden') collectedGolden++;
    }

    if (ev.fellOut || p.isDead) {
      return {
        cleared: false,
        elapsedSec: step * dt,
        finalX: p.x,
        landedPlatIds,
        attachedRingIds,
        collectedGolden,
        maxAttachSightDistance,
      };
    }

    if (p.onGround && p.x >= opts.goalX) {
      return {
        cleared: true,
        elapsedSec: step * dt,
        finalX: p.x,
        landedPlatIds,
        attachedRingIds,
        collectedGolden,
        maxAttachSightDistance,
      };
    }
  }

  return {
    cleared: false,
    elapsedSec: maxSteps * dt,
    finalX: p.x,
    landedPlatIds,
    attachedRingIds,
    collectedGolden,
    maxAttachSightDistance,
  };
}

test('target ground speeds, wire non-auto-switch, and strictly-forward ring selection invariants hold', () => {
  const s1Mid = getTargetGroundSpeed(
    (COURSE_BOUNDS.startX + COURSE_BOUNDS.stage1EndX) * 0.5,
    false
  );
  const s2Mid = getTargetGroundSpeed(
    (COURSE_BOUNDS.stage1EndX + COURSE_BOUNDS.stage2EndX) * 0.5,
    false
  );
  const s3Mid = getTargetGroundSpeed(
    (COURSE_BOUNDS.stage2EndX + COURSE_BOUNDS.arrivalStartX) * 0.5,
    false
  );

  assert.ok(s1Mid >= 455 && s1Mid <= 485);
  assert.ok(s2Mid >= 515 && s2Mid <= 555);
  assert.ok(s3Mid >= 590 && s3Mid <= 635);

  // Smooth C0-continuous speed transitions across Stage 1->2 and Stage 2->3
  assert.ok(
    Math.abs(
      getTargetGroundSpeed(COURSE_BOUNDS.stage1EndX + 1, false) -
        getTargetGroundSpeed(COURSE_BOUNDS.stage1EndX - 1, false)
    ) < 0.5
  );
  assert.ok(
    Math.abs(
      getTargetGroundSpeed(COURSE_BOUNDS.stage2EndX + 1, false) -
        getTargetGroundSpeed(COURSE_BOUNDS.stage2EndX - 1, false)
    ) < 0.5
  );

  // Never select a ring behind player or behind grapple hand (origin.x = player.x + 20)
  const samplePlayer = createPlayerState(1000, 420, 500);
  samplePlayer.onGround = false;
  const rings = [
    { id: 'behind_body', x: 960, y: 150 },
    { id: 'behind_hand', x: 1012, y: 150 }, // ahead of x=1000, but behind origin.x=1020!
    { id: 'forward_near', x: 1240, y: 160 },
    { id: 'forward_far', x: 1410, y: 130 },
  ];
  const chosen = selectBestRing(samplePlayer, rings);
  assert.equal(chosen?.id, 'forward_near');

  const onlyBehind = selectBestRing(samplePlayer, [
    { id: 'behind_body', x: 960, y: 150 },
    { id: 'behind_hand', x: 1015, y: 150 },
  ]);
  assert.equal(onlyBehind, null);

  // Holding wire input while swinging on Ring A NEVER auto-switches to Ring B
  const p = createPlayerState(500, 380, 520);
  p.onGround = false;
  p.hasJumpedSinceGrounded = true;
  const twoRings = [
    { id: 'rA', x: 720, y: 130 },
    { id: 'rB', x: 980, y: 130 },
  ];
  const attachEv = stepPlayerPhysics(
    p,
    PHYSICS_CONFIG.fixedDt,
    { justPressed: true, held: true, justReleased: false },
    [],
    twoRings,
    false
  );
  assert.equal(attachEv.attachedRing?.id, 'rA');
  for (let i = 0; i < 90; i++) {
    stepPlayerPhysics(
      p,
      PHYSICS_CONFIG.fixedDt,
      { justPressed: false, held: true, justReleased: false },
      [],
      twoRings,
      false
    );
    assert.equal(p.attachedRingId, 'rA');
  }
});

test('Course structure meets all Stage 1, Stage 2, and Stage 3 challenge counts & first-ring highlight', () => {
  const course = buildMainCourse();
  const challenges = course.challenges ?? [];

  // Stage 1: safe 5~8s opening + >= 3 mandatory single-wire sections + highlighted 1st ring
  const s1Challenges = challenges.filter((c) => c.stageId === 1);
  assert.ok(
    s1Challenges.length >= 3,
    `Expected >=3 Stage 1 wire challenges, got ${s1Challenges.length}`
  );
  const firstChasmX = s1Challenges[0].chasmStartX;
  const openingRunSec = (firstChasmX - course.startX) / 462;
  assert.ok(
    openingRunSec >= 5.2 && openingRunSec <= 8.5,
    `Expected 5~8s safe opening before 1st wire chasm, got ${openingRunSec.toFixed(2)}s`
  );
  assert.equal(course.rings[0].isFirstHighlight, true);

  // Stage 2: >= 4 mandatory wire clusters, including >= 2 mandatory A->B re-connections + Patterns A, B, C, D
  const s2Challenges = challenges.filter((c) => c.stageId === 2);
  assert.ok(
    s2Challenges.length >= 4,
    `Expected >=4 Stage 2 wire clusters, got ${s2Challenges.length}`
  );
  const s2DoubleWires = s2Challenges.filter((c) => c.minRequiredRings === 2);
  assert.ok(
    s2DoubleWires.length >= 2,
    `Expected >=2 Stage 2 A->B double-wire challenges, got ${s2DoubleWires.length}`
  );
  assert.ok(s2Challenges.some((c) => c.kind === 'elevation-wire'));
  assert.ok(s2Challenges.some((c) => c.kind === 'split-release'));
  assert.ok(s2Challenges.some((c) => c.kind === 'short-pier-combo'));

  // Stage 3: >= 4 mandatory wire clusters, including >= 2 floorless A->B->C triple-wire chains + comprehensive finale
  const s3Challenges = challenges.filter((c) => c.stageId === 3);
  assert.ok(
    s3Challenges.length >= 4,
    `Expected >=4 Stage 3 wire clusters, got ${s3Challenges.length}`
  );
  const s3TripleWires = s3Challenges.filter(
    (c) => c.kind === 'triple-wire' && c.minRequiredRings === 3
  );
  assert.ok(
    s3TripleWires.length >= 2,
    `Expected >=2 Stage 3 floorless A->B->C triple-wire challenges, got ${s3TripleWires.length}`
  );
  assert.ok(s3Challenges.some((c) => c.kind === 'comprehensive-finale'));

  // Verify every floorless A->B->C triple-wire has ZERO floor inside chasm and varied ring heights/spacings
  for (const tw of s3TripleWires) {
    const midFloor = course.platforms.find(
      (pl) => pl.x + pl.width > tw.chasmStartX + 5 && pl.x < tw.endX - 5
    );
    assert.equal(
      midFloor,
      undefined,
      `Triple-wire ${tw.id} must have zero intermediate floor`
    );

    const [rA, rB, rC] = tw.ringIds.map(
      (id) => course.rings.find((r) => r.id === id)!
    );
    assert.notEqual(rA.y, rB.y, `${tw.id} Ring A and B heights should vary`);
    assert.notEqual(rB.y, rC.y, `${tw.id} Ring B and C heights should vary`);
    assert.notEqual(
      rB.x - rA.x,
      rC.x - rB.x,
      `${tw.id} Ring A->B and B->C spacings should vary`
    );
  }

  // Non-overlapping snowflakes & platform safe-zone check
  for (const pl of course.platforms) {
    assert.ok(pl.y <= 525, `Platform ${pl.id} y=${pl.y} intrudes into HUD bar`);
  }
  for (let i = 0; i < course.snowflakes.length; i++) {
    for (let j = i + 1; j < course.snowflakes.length; j++) {
      const a = course.snowflakes[i];
      const b = course.snowflakes[j];
      if (Math.abs(a.x - b.x) > 65) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(
        d >= 56,
        `Snowflakes ${a.id} and ${b.id} overlap (${d.toFixed(1)}px)`
      );
    }
  }
});

test('ZERO mandatory wire challenges can be bypassed by jumping alone (even frame-perfect coyote edge jumps) or by infinite holding', () => {
  const course = buildMainCourse();
  const challenges = course.challenges ?? [];

  for (const ch of challenges) {
    const startPlat = course.platforms.find((p) => p.id === ch.startPlatId)!;
    const edgeX = startPlat.x + startPlat.width;

    // 1. Sweep all jump timings near & past platform edge (coyote time) WITHOUT wire
    for (const jumpOffsetFromEdge of [-45, -20, -4, 12, 28, 42]) {
      const p = createPlayerState(
        edgeX - 120,
        startPlat.y,
        getTargetGroundSpeed(edgeX, false)
      );
      let jumped = false;
      let survivedAcrossFirstChasm = false;

      // Determine the immediate first landing platform across the chasm
      const firstTargetX = course.platforms
        .filter((pl) => pl.x > edgeX + 50)
        .reduce((minX, pl) => Math.min(minX, pl.x), Infinity);

      for (let step = 0; step < 300; step++) {
        const shouldPressJump = !jumped && p.x >= edgeX + jumpOffsetFromEdge;
        if (shouldPressJump) jumped = true;
        stepPlayerPhysics(
          p,
          PHYSICS_CONFIG.fixedDt,
          {
            justPressed: shouldPressJump,
            held: shouldPressJump,
            justReleased: false,
          },
          course.platforms,
          course.rings,
          false
        );
        if (p.isDead) break;
        if (p.onGround && p.x >= firstTargetX) {
          survivedAcrossFirstChasm = true;
          break;
        }
      }

      assert.equal(
        survivedAcrossFirstChasm,
        false,
        `Challenge ${ch.id} (${ch.label}) was bypassed by jump-only at offset ${jumpOffsetFromEdge}!`
      );
    }

    // 2. Verify holding wire forever without releasing CANNOT auto-clear the challenge
    const holdRes = simulatePlaySegment(course, {
      spawnX: ch.startX,
      spawnY: startPlat.y,
      goalX: ch.endX + 40,
      holdForeverOnWire: true,
      maxSeconds: 18,
    });
    assert.equal(
      holdRes.cleared,
      false,
      `Challenge ${ch.id} (${ch.label}) auto-cleared by holding wire forever!`
    );
  }
});

test('Mandatory A->B double-wire and A->B->C triple-wire challenges strictly require re-connecting all rings & proper upswing release timing', () => {
  const course = buildMainCourse();
  const challenges: ChallengeClusterDef[] = course.challenges ?? [];

  for (const ch of challenges) {
    const startPlat = course.platforms.find((p) => p.id === ch.startPlatId)!;

    // 1. Verify EVERY individual challenge clears cleanly with legal discrete player inputs!
    const clearRes = simulatePlaySegment(course, {
      spawnX: ch.startX,
      spawnY: startPlat.y,
      goalX: ch.endX + 60,
      maxSeconds: 22,
    });
    assert.equal(
      clearRes.cleared,
      true,
      `Challenge ${ch.id} (${ch.label}) failed to clear at x=${clearRes.finalX} (goal=${ch.endX})`
    );

    // Verify fair sightline: attached ring was always well inside the 1,005px forward camera view!
    assert.ok(
      clearRes.maxAttachSightDistance <= 480,
      `Challenge ${ch.id} required off-screen/out-of-range attach (${clearRes.maxAttachSightDistance}px)`
    );

    // 2. For A->B (minRequiredRings=2) and A->B->C (minRequiredRings=3), using (N-1) rings MUST fail!
    if (
      (ch.kind === 'double-wire' || ch.kind === 'triple-wire') &&
      ch.minRequiredRings >= 2
    ) {
      for (const relDx of [70, 115, 160, 200]) {
        const fewerRingsRes = simulatePlaySegment(course, {
          spawnX: ch.startX,
          spawnY: startPlat.y,
          goalX: ch.endX + 40,
          maxRingsPerAirborne: ch.minRequiredRings - 1,
          releaseDxThreshold: relDx,
          releaseVyThreshold: -80,
          maxSeconds: 15,
        });
        assert.equal(
          fewerRingsRes.cleared,
          false,
          `${ch.id} cleared using only ${ch.minRequiredRings - 1}/${ch.minRequiredRings} rings (relDx=${relDx})!`
        );
      }
    }

    // 3. For A->B->C triple-wire, releasing too early (before upswing, dx=10, vy=+80) fails to complete chain!
    if (ch.kind === 'triple-wire') {
      const prematureRelease = simulatePlaySegment(course, {
        spawnX: ch.startX,
        spawnY: startPlat.y,
        goalX: ch.endX + 40,
        releaseDxThreshold: -10,
        releaseVyThreshold: 250, // releases immediately while still swinging downward!
        maxSeconds: 15,
      });
      assert.equal(
        prematureRelease.cleared,
        false,
        `Triple-wire ${ch.id} should depend on upswing release timing to reach subsequent rings`
      );
    }
  }
});

test('Stage 2 Pattern C (S2-C3) lands on Lower Safe Platform on early release and Upper Golden Platform on proper upswing release', () => {
  const course = buildMainCourse();
  const splitChallenge = course.challenges!.find((c) => c.id === 'S2-C3')!;
  const startPlat = course.platforms.find(
    (p) => p.id === splitChallenge.startPlatId
  )!;

  // 1. Early release (dx >= 70, vy <= -60) -> lands on Lower Safe Platform and clears to reunite terrace!
  const earlyRes = simulatePlaySegment(course, {
    spawnX: splitChallenge.startX,
    spawnY: startPlat.y,
    goalX: splitChallenge.endX + 80,
    releaseDxThreshold: 70,
    releaseVyThreshold: -60,
    maxSeconds: 15,
  });
  assert.equal(earlyRes.cleared, true, 'Early release on S2-C3 must survive');
  assert.ok(
    earlyRes.landedPlatIds.includes(splitChallenge.lowerPlatId!),
    `Expected early release to land on lower platform ${splitChallenge.lowerPlatId}, got ${earlyRes.landedPlatIds.join(',')}`
  );
  assert.ok(
    !earlyRes.landedPlatIds.includes(splitChallenge.upperPlatId!),
    'Early release should stay on lower route, not upper platform'
  );

  // 2. Proper strong upswing release (dx >= 155, vy <= -260) -> lands on Upper Golden Platform, collects Golden Snowflakes, and clears!
  const optimalRes = simulatePlaySegment(course, {
    spawnX: splitChallenge.startX,
    spawnY: startPlat.y,
    goalX: splitChallenge.endX + 80,
    releaseDxThreshold: 155,
    releaseVyThreshold: -260,
    maxSeconds: 15,
  });
  assert.equal(
    optimalRes.cleared,
    true,
    'Optimal upswing release on S2-C3 must survive'
  );
  assert.ok(
    optimalRes.landedPlatIds.includes(splitChallenge.upperPlatId!),
    `Expected optimal release to land on upper platform ${splitChallenge.upperPlatId}, got ${optimalRes.landedPlatIds.join(',')}`
  );
  assert.ok(
    optimalRes.collectedGolden >= 1,
    'Upper platform route should reward Golden Snowflakes'
  );
});

test('Tutorial (~16-22s) and Full 3-Stage Main Course (90~120s target) clear 100% end-to-end with legal inputs', () => {
  const tutorial = buildTutorialCourse();
  const tutRes = simulatePlaySegment(tutorial, {
    spawnX: tutorial.startX,
    spawnY: tutorial.startY,
    goalX: tutorial.arrivalStartX + 40,
    maxSeconds: 35,
  });
  assert.equal(tutRes.cleared, true, `Tutorial failed at x=${tutRes.finalX}`);
  assert.ok(tutRes.elapsedSec >= 14 && tutRes.elapsedSec <= 25);

  const mainCourse = buildMainCourse();
  const mainRes = simulatePlaySegment(mainCourse, {
    spawnX: mainCourse.startX,
    spawnY: mainCourse.startY,
    goalX: mainCourse.arrivalStartX + 40,
    maxSeconds: 150,
  });
  assert.equal(
    mainRes.cleared,
    true,
    `Main course failed at x=${mainRes.finalX} / ${mainCourse.arrivalStartX}`
  );
  assert.ok(
    mainRes.elapsedSec >= 90 && mainRes.elapsedSec <= 120,
    `Expected Main Course clear time inside 90~120s, got ${mainRes.elapsedSec.toFixed(1)}s`
  );
});

test('Contextual failure hint analyzer produces specific hints when cause is known and null when ambiguous', () => {
  assert.match(
    analyzeFailureHint({
      jumpedFromGround: true,
      attachedRingCount: 1,
      lastReleaseDx: 130,
      lastReleaseVy: -220,
      wasSwingingOrStalledBackward: false,
      sawValidUnattachedRingAfterRelease: true,
      hasSubsequentChasmRingAhead: true,
      chasmHadInitialOverheadRing: true,
    }) ?? '',
    /다음 고리로 연결/
  );

  assert.match(
    analyzeFailureHint({
      jumpedFromGround: true,
      attachedRingCount: 1,
      lastReleaseDx: 35,
      lastReleaseVy: 90,
      wasSwingingOrStalledBackward: false,
      sawValidUnattachedRingAfterRelease: false,
      hasSubsequentChasmRingAhead: false,
      chasmHadInitialOverheadRing: true,
    }) ?? '',
    /늦게 놓아/
  );

  assert.equal(
    analyzeFailureHint({
      jumpedFromGround: true,
      attachedRingCount: 0,
      lastReleaseDx: null,
      lastReleaseVy: null,
      wasSwingingOrStalledBackward: false,
      sawValidUnattachedRingAfterRelease: false,
      hasSubsequentChasmRingAhead: false,
      chasmHadInitialOverheadRing: false,
    }),
    null
  );

  // Scoring & progress sanity check
  assert.equal(computeCourseProgress(285, 285, 53375, false), 0);
  assert.equal(computeCourseProgress(53375, 285, 53375, false), 1);
  assert.equal(calculateScores(285, 685, 2, 1).totalScore, 80);
});

test('Sprite sheet flood-fill and tight snowflake bounds stay intact', () => {
  const { width, height, rgba: fullRgba } = decodePngRgba(
    'public/assets/aistudio/image_72d00242.png'
  );
  const cellW = width / 4;
  const cellH = height / 2;
  const cell = new Uint8ClampedArray(cellW * cellH * 4);
  for (let y = 0; y < cellH; y++) {
    for (let x = 0; x < cellW; x++) {
      const srcP = ((1 * cellH + y) * width + (2 * cellW + x)) * 4;
      const dstP = (y * cellW + x) * 4;
      cell[dstP] = fullRgba[srcP];
      cell[dstP + 1] = fullRgba[srcP + 1];
      cell[dstP + 2] = fullRgba[srcP + 2];
      cell[dstP + 3] = fullRgba[srcP + 3];
    }
  }
  removeOuterWhiteFromCellRgba(cell, cellW, cellH, SPRITE_CONFIG.extraBgSeeds[6]);
  assert.equal(cell[3], 0);
  assert.equal(cell[(156 * cellW + 275) * 4 + 3], 0);
  assert.equal(
    cell[(168 * cellW + Math.round(SPRITE_CONFIG.rawFaceCentersX[6])) * 4 + 3],
    255
  );

  const sf = decodePngRgba('public/assets/aistudio/image_9756b79f.png');
  const bounds = findContentBoundsRgba(sf.rgba, sf.width, sf.height, 24);
  assert.ok(bounds.minX > 150 && bounds.maxX < 1100);
});
