export type GameModeState =
  | 'READY'
  | 'INTRO'
  | 'TUTORIAL'
  | 'RUNNING'
  | 'PAUSED'
  | 'GAMEOVER'
  | 'ENDING'
  | 'RESULT';

export type ActivePlayState = 'INTRO' | 'TUTORIAL' | 'RUNNING' | 'ENDING';

export type StageId = 1 | 2 | 3;

export interface PlatformDef {
  id: string;
  x: number; // Left world X
  y: number; // Top surface world Y
  width: number;
  height?: number;
  isArrival?: boolean;
}

export interface RingDef {
  id: string;
  x: number;
  y: number;
  isFirstHighlight?: boolean;
}

export type ChallengeKind =
  | 'single-wire'
  | 'elevation-wire'
  | 'double-wire'
  | 'split-release'
  | 'short-pier-combo'
  | 'triple-wire'
  | 'comprehensive-finale';

export interface ChallengeClusterDef {
  id: string;
  stageId: StageId;
  kind: ChallengeKind;
  label: string;
  startPlatId: string;
  startX: number;
  chasmStartX: number;
  endX: number;
  ringIds: string[];
  minRequiredRings: number;
  lowerPlatId?: string;
  upperPlatId?: string;
}

export type SnowflakeKind = 'normal' | 'golden';

export interface SnowflakeDef {
  id: string;
  x: number;
  y: number;
  kind: SnowflakeKind;
  collected?: boolean;
}

export interface GuideSignDef {
  id: string;
  x: number;
  y: number;
  title: string;
  subtitle: string;
}

export interface CourseData {
  mode: 'tutorial' | 'main';
  startX: number;
  startY: number;
  stage1EndX: number;
  stage2EndX: number;
  arrivalStartX: number;
  totalEndX: number;
  wireCheckpoint?: { x: number; y: number; triggerAfterX: number };
  platforms: PlatformDef[];
  rings: RingDef[];
  snowflakes: SnowflakeDef[];
  guides: GuideSignDef[];
  challenges?: ChallengeClusterDef[];
}

export interface StageConfig {
  id: StageId;
  name: string;
  shortName: string;
  bannerTitle: string;
  textureKey: string;
  startX: number;
  endX: number;
  startSpeed: number;
  endSpeed: number;
}

export interface PlayerPhysicsState {
  x: number; // Horizontal center of body collider
  y: number; // Bottom of feet! Matches platform top surface Y when grounded
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  onGround: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  hasJumpedSinceGrounded: boolean;
  isSwinging: boolean;
  attachedRingId: string | null;
  attachedRingX: number;
  attachedRingY: number;
  ropeLength: number;
  lastDetachedRingId: string | null;
  landingSquash: number; // Visual-only compression factor [0..1], never affects collider
  jumpStretch: number; // Visual-only stretch factor [0..1], never affects collider
  strideDistance: number;
  isDead: boolean;
  landedOnArrival: boolean;
}

export interface StepEvents {
  jumped: boolean;
  landed: boolean;
  landingImpactVy: number;
  wireAttached: boolean;
  wireDetached: boolean;
  attachedRing: RingDef | null;
  fellOut: boolean;
  reachedArrival: boolean;
}

export interface RunStats {
  runId: string;
  ruleVersion: string;
  totalScore: number;
  distanceScore: number;
  snowflakeScore: number;
  distanceMeters: number;
  normalCount: number;
  goldenCount: number;
  totalCourseSnowflakes: number;
  collectedUniqueSnowflakes: number;
  collectionRatio: number;
  collectionPercent: number;
  earnedSnowflowerBadge: boolean;
  highScore: number;
  isNewRecord: boolean;
  isTutorial: boolean;
  isDevRun: boolean;
  cleared: boolean;
  failureHint?: string | null;
}

export interface LeaderboardEntry {
  docId: string;
  isSelf: boolean;
  nickname: string;
  tagCode: string;
  tieBreaker: string;
  ruleVersion: string;
  score: number;
  normalCount: number;
  goldenCount: number;
  distanceMeters: number;
  cleared: boolean;
  achievedAtMs: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
}

export type ScoreSubmissionStatus =
  | 'idle'
  | 'submitting'
  | 'registered'
  | 'kept_best'
  | 'failed'
  | 'ineligible';

export interface ScoreSubmissionState {
  status: ScoreSubmissionStatus;
  runId: string | null;
  bestScore?: number;
  message?: string;
  ineligibleReason?: 'tutorial' | 'dev' | null;
  needsAnonymousAuthEnable?: boolean;
}

export interface EndingUiState {
  phase: 'ARRIVAL' | 'STORY';
  elapsed: number;
  arrivalFadeAlpha: number; // 0..1 smooth crossfade into ending_01.png at end of 2.6s arrival
  storyStepIndex: number; // 0..3 across ending_01 (0,1) and ending_02 (2,3)
  isBonusUnlocked: boolean;
  collectionPercent: number;
  collectedUniqueSnowflakes: number;
  totalCourseSnowflakes: number;
}

export interface HudSnapshot {
  mode: GameModeState;
  resumeTarget: ActivePlayState;
  introStepIndex: number; // 0, 1, 2 for 1/3, 2/3, 3/3
  isTutorialCourse: boolean;
  score: number;
  distanceMeters: number;
  normalCount: number;
  goldenCount: number;
  highScore: number;
  stageId: StageId;
  stageName: string;
  progress: number; // Exact world progress clamped 0..1 (1.0 when cleared)
  displayProgress: number; // Smoothed anti-jitter progress for marker rendering
  stageRatios: [number, number, number]; // Proportional lengths of Stage 1, 2, 3 summing to 1
  stageBanner: string | null;
  stageSubBanner: string | null;
  tutorialHint: string | null;
  tutorialCompleted: boolean;
  bgmMuted: boolean;
  sfxMuted: boolean;
  ending: EndingUiState | null;
  resultStats: RunStats | null;
  failureHint: string | null;
  debugEnabled: boolean;
}
