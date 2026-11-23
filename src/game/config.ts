import { StageConfig } from './types';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/**
 * Resolves a static file path inside `public/` against Vite's `BASE_URL`
 * (`'/'` in local dev, `'/talju-ninja-songi/'` in GitHub Pages production builds).
 * Falls back to `'/'` when executed outside Vite (e.g. Node unit tests).
 */
export function resolveAssetPath(
  relativePath: string,
  baseOverride?: string
): string {
  const rawBase =
    baseOverride ??
    (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/');
  const normalizedBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const cleanRelative = relativePath.replace(/^\/+/, '');
  return `${normalizedBase}${cleanRelative}`;
}

export const ASSET_PATHS = {
  // Newly attached chubby Ninja Songi 4x2 sprite sheet
  ninjaSongiSheet: resolveAssetPath('assets/aistudio/image_72d00242.png'),
  stage1Sunheon: resolveAssetPath('assets/aistudio/image_4b84bc00.png'),
  stage2Myungshin: resolveAssetPath('assets/aistudio/image_bc8dc3e7.png'),
  stage3Snowflower: resolveAssetPath('assets/aistudio/image_04e73209.png'),
  snowflakeIcon: resolveAssetPath('assets/aistudio/image_9756b79f.png'),
  // Story Intro (3) & Ending (2) illustrations verified by visual content
  intro01: resolveAssetPath('assets/aistudio/____________-1_d1f251a1.png'),
  intro02: resolveAssetPath('assets/aistudio/_________________-2_4d18a9f2.png'),
  intro03: resolveAssetPath('assets/aistudio/__________________-3_87978855.png'),
  ending01: resolveAssetPath('assets/aistudio/_____________-4_30702ff4.png'),
  ending02: resolveAssetPath('assets/aistudio/_______________-5_d46d508d.png'),
} as const;

export const TEXTURE_KEYS = {
  songiRaw: 'songi_chubby_raw',
  songiSheet: 'ninja_songi_chubby_sheet',
  stage1: 'stage1_sunheon',
  stage2: 'stage2_myungshin',
  stage3: 'stage3_snowflower',
  snowflakeRaw: 'snowflake_raw',
  snowflakeNormal: 'snowflake_normal_cropped',
  snowflakeGolden: 'snowflake_golden_full',
  intro01: 'story_intro_01',
  intro02: 'story_intro_02',
  intro03: 'story_intro_03',
  ending01: 'story_ending_01',
  ending02: 'story_ending_02',
} as const;

export const PHYSICS_CONFIG = {
  fixedDt: 1 / 120,
  maxFrameDeltaSec: 0.05,
  gravity: 1950,
  jumpVelocity: -710,
  tutorialRunSpeed: 430,
  baseRunSpeed: 460,
  coyoteTimeSec: 0.095,
  jumpBufferSec: 0.11,
  maxWireRange: 475,
  minRopeLength: 82,
  swingPumpAccel: 390,
  maxSwingSpeed: 920,
  groundRecoverRate: 8.0,
  // Raised fall boundary & platform band so bottom progress bar never hides platforms or pits
  fallDeathY: 710,
  // Dynamic horizontal camera anchor: 275px at base speed -> 215px during fast swings (1,005~1,065px forward sightline!)
  playerScreenX: 275,
  minPlayerScreenX: 215,
  // Fixed collider fitted to chubby Songi's torso and shoes (not wide snowflower head/scarf)
  colliderWidth: 44,
  colliderHeight: 68,
  // Grapple origin relative to player (x = body center, y = feet bottom)
  grappleOriginOffsetX: 20,
  grappleOriginOffsetY: -76,
  // Collection center & radii matched to visible 42px / 56px snowflakes + light margin
  collectCenterOffsetY: -62,
  collectRadiusNormal: 46,
  collectRadiusGolden: 54,
} as const;

export const SPRITE_CONFIG = {
  cols: 4,
  rows: 2,
  // Generous output cell dimensions (432x528) prevent any headband/scarf/hand clipping after centering
  normCellWidth: 432,
  normCellHeight: 528,
  // Visible character height in 1280x720 logical space (~125-140px target -> 132px)
  visibleCharHeightPx: 132,
  // Measured character height in 528px cell (~418px from snowflower tip y=66 to shoe sole y=484)
  sourceCharPixelHeight: 418,
  // Base run animation frame rate (~12-16fps, scales dynamically with actual running speed)
  runBaseFps: 14,
  runForwardLeanRad: 0.052,
  // Normalized anchor points inside 432x528 cell
  targetFaceCenterX: 246,
  originNormX: 228 / 432, // Torso/foot horizontal center
  originFootNormY: 484 / 528, // Exact shoe bottom line
  // Measured raw face centers X in 384x512 cells of image_72d00242.png (frames 0..7)
  rawFaceCentersX: [247, 236, 241, 248, 218.5, 212, 201.5, 220] as readonly number[],
  // Measured vertical offsets onto 528px cell so feet & head stay level with zero frame-swap pop
  normShiftY: [18, 22, 19, 15, 52, 33, 42, 18] as readonly number[],
  // Extra enclosed white background seed points per frame in raw 384x512 coords
  // Frame 6 has a small enclosed background gap between right crown tip & raised arm at (275, 156)
  extraBgSeeds: {
    6: [{ x: 275, y: 156 }],
  } as Record<number, ReadonlyArray<{ x: number; y: number }>>,
  // Normalized raised wire-holding hand position in Frame 6 (inside 432x528 cell)
  wireHandNormX: (312 + (246 - 201.5)) / 432,
  wireHandNormY: (152.5 + 42) / 528,
  // Normalized sitting hip/hand contact line in Frame 7 (inside 432x528 cell)
  sitContactNormY: (378 + 18) / 528,
} as const;

export const SNOWFLAKE_DISPLAY = {
  // Tight-cropped textures fill ~95% of canvas so visible artwork diameter matches displaySize
  normalDiameterPx: 43, // 40~44px target
  goldenDiameterPx: 56, // 52~58px target
} as const;

export const SCORE_CONFIG = {
  pxPerMeter: 40,
  normalSnowflakePoints: 10,
  goldenSnowflakePoints: 50,
} as const;

/**
 * Course coordinates scaled for a 90~120 second full run across 3 skill-progressive wire stages:
 * - Stage 1 (~32s): Basic single-wire mastery
 * - Stage 2 (~36s): Mid-air re-connection (A->B), elevation wires, split release timing, short piers
 * - Stage 3 (~35s): Triple-wire chains (A->B->C), narrow landings, and comprehensive finale
 */
export const COURSE_BOUNDS = {
  startX: 285,
  defaultFloorY: 492, // Elevated above bottom HUD safe zone (y=648..720)
  stage1EndX: 15220,
  stage2EndX: 34770,
  arrivalStartX: 53855,
  arrivalEndX: 56455,
  endingLedgeOffsetFromArrival: 560,
} as const;

/**
 * Smooth C0-continuous speed ramp across Stage 1 -> Stage 2 -> Stage 3:
 * - Stage 1: 455 -> 485 px/s (avg ~468 px/s, ~460 target)
 * - Stage 2: 485 -> 575 px/s (avg ~538 px/s, ~540 target)
 * - Stage 3: 575 -> 635 px/s (avg ~612 px/s, ~620 target)
 * Matching startSpeed[i+1] === endSpeed[i] prevents any sudden velocity jump at stage borders!
 */
export const STAGE_CONFIGS: readonly StageConfig[] = [
  {
    id: 1,
    name: '순헌관 야간 탈출',
    shortName: '순헌관',
    bannerTitle: '1구간 · 순헌관 야간 탈출',
    textureKey: TEXTURE_KEYS.stage1,
    startX: COURSE_BOUNDS.startX,
    endX: COURSE_BOUNDS.stage1EndX,
    startSpeed: 455,
    endSpeed: 485,
  },
  {
    id: 2,
    name: '명신관 언덕 돌파',
    shortName: '명신관',
    bannerTitle: '2구간 · 명신관 언덕 돌파',
    textureKey: TEXTURE_KEYS.stage2,
    startX: COURSE_BOUNDS.stage1EndX,
    endX: COURSE_BOUNDS.stage2EndX,
    startSpeed: 485,
    endSpeed: 575,
  },
  {
    id: 3,
    name: '눈꽃광장으로!',
    shortName: '눈꽃광장',
    bannerTitle: '3구간 · 눈꽃광장으로!',
    textureKey: TEXTURE_KEYS.stage3,
    startX: COURSE_BOUNDS.stage2EndX,
    endX: COURSE_BOUNDS.arrivalStartX,
    startSpeed: 575,
    endSpeed: 635,
  },
] as const;

export const ENDING_CONFIG = {
  title: '오늘의 임무: 푹 쉬기',
  arrivalDecelSec: 2.6, // 2~3s plaza deceleration & snowflower illumination before crossfading into ending_01
  arrivalCrossfadeStartSec: 1.75,
  crossfadeBgSec: 1.2,
  stageBannerSec: 2.6,
  maxEndingSnowflakes: 48,
  minEndingSnowflakes: 14,
  bonusCollectionThreshold: 0.8,
} as const;

export const GAME_RULE_VERSION = 'v1_course_5314' as const;

export const LEADERBOARD_CONFIG = {
  ruleVersion: GAME_RULE_VERSION,
  collectionName: `leaderboard_${GAME_RULE_VERSION}`,
  scoreRunsCollection: 'score_runs',
  topLimit: 50,
  queryLimit: 60,
  minSubmitCooldownMs: 2200,
} as const;

export const COURSE_VALIDATION_BOUNDS = {
  maxNormalCount: 231,
  maxGoldenCount: 32,
  maxDistanceMeters: 1404,
  minClearedDistanceMeters: 1339,
  maxScore: 5314,
} as const;

export const STORAGE_KEYS = {
  highScore: 'runaway_ninja_songi_high_score_v1',
  bgmMuted: 'runaway_ninja_songi_bgm_muted_v1',
  sfxMuted: 'runaway_ninja_songi_sfx_muted_v1',
  snowflowerBadge: 'runaway_ninja_songi_snowflower_badge_v1',
  nickname: 'runaway_ninja_songi_nickname_v1',
} as const;
