import Phaser from 'phaser';
import { SoundManager } from './audio';
import {
  ASSET_PATHS,
  COURSE_BOUNDS,
  ENDING_CONFIG,
  GAME_HEIGHT,
  GAME_RULE_VERSION,
  GAME_WIDTH,
  PHYSICS_CONFIG,
  SCORE_CONFIG,
  SNOWFLAKE_DISPLAY,
  SPRITE_CONFIG,
  STAGE_CONFIGS,
  TEXTURE_KEYS,
} from './config';
import { buildMainCourse, buildTutorialCourse } from './courses';
import { UnifiedInputController } from './input';
import { generateRunId } from './leaderboardLogic';
import {
  AirborneFailureTelemetry,
  analyzeFailureHint,
  calculateScores,
  collectSnowflakesInStep,
  computeCourseProgress,
  createPlayerState,
  findValidRings,
  getStageForX,
  selectBestRing,
  stepPlayerPhysics,
} from './physics';
import {
  buildGoldenSnowflakeCanvas,
  buildNormalSnowflakeCanvas,
  buildNormalizedSongiSheet,
} from './spriteProcessor';
import {
  loadHighScore,
  loadSnowflowerBadgeUnlocked,
  saveHighScore,
  saveSnowflowerBadgeUnlocked,
} from './storage';
import {
  advanceEndingStoryStep,
  advanceIntroStep,
  computeUniqueSnowflakeStats,
  rewindIntroStep,
  STAGE1_STORY_CALLOUT,
} from './story';
import {
  ActivePlayState,
  CourseData,
  EndingUiState,
  GameModeState,
  HudSnapshot,
  PlatformDef,
  PlayerPhysicsState,
  RingDef,
  RunStats,
  SnowflakeDef,
  StageId,
} from './types';

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  alpha: number;
  gravity: number;
}

interface FloatingScorePopup {
  active: boolean;
  textObj: Phaser.GameObjects.Text;
  life: number;
  maxLife: number;
  vy: number;
}

interface AfterimageGhost {
  active: boolean;
  sprite: Phaser.GameObjects.Sprite;
  life: number;
  maxLife: number;
}

interface EndingSnowParticle {
  active: boolean;
  sprite: Phaser.GameObjects.Image;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  t: number;
  speed: number;
  wobblePhase: number;
  isGolden: boolean;
}

const MAX_PARTICLES = 100;
const MAX_AFTERIMAGES = 6;
const MAX_POPUPS = 10;

export class GameScene extends Phaser.Scene {
  private inputCtrl: UnifiedInputController;
  private soundMgr: SoundManager;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private mode: GameModeState = 'READY';
  private resumeTarget: ActivePlayState = 'RUNNING';
  private introStepIndex = 0;
  private debugEnabled = false;
  private sceneCreated = false;
  private pendingIntroOpen = false;
  private pendingStartOptions: {
    tutorial?: boolean;
    startStage?: StageId;
    isDevRun?: boolean;
  } | null = null;
  private isDevSession = false;
  private currentRunId: string = generateRunId();
  private currentRunIsDev = false;

  private course: CourseData = buildMainCourse();
  private player: PlayerPhysicsState = createPlayerState(
    COURSE_BOUNDS.startX,
    COURSE_BOUNDS.defaultFloorY
  );
  private accumulatorSec = 0;

  private normalCount = 0;
  private goldenCount = 0;
  private highScore = loadHighScore();
  private lockedStats: RunStats | null = null;
  private lastFailureHint: string | null = null;

  // Dynamic forward camera lookahead (275px -> 215px during fast swings)
  private currentCameraScreenX: number = PHYSICS_CONFIG.playerScreenX;

  // Airborne telemetry for accurate, non-presumptuous failure hints
  private airJumpedFromGround = false;
  private airAttachedRingIds: string[] = [];
  private airLastReleaseDx: number | null = null;
  private airLastReleaseVy: number | null = null;
  private airSawValidRingAfterRelease = false;
  private airSawInitialOverheadRing = false;
  private airLastGroundedEdgeX: number = COURSE_BOUNDS.startX;

  // Anti-jitter smoothed progress tracking (strictly world-X driven)
  private maxReachedProgress = 0;
  private smoothedDisplayProgress = 0;

  private activeStageId: StageId = 1;
  private shownStageBanners = new Set<StageId>();
  private stageBannerText: string | null = null;
  private stageSubBannerText: string | null = null;
  private stageBannerTimer = 0;
  private tutorialHintText: string | null = null;
  private tutorialRespawnNoticeTimer = 0;
  private tutorialCompleted = false;

  // Background layers (screen space, aspect-preserved)
  private bgSprites: Record<StageId, Phaser.GameObjects.Image | null> = {
    1: null,
    2: null,
    3: null,
  };
  private bgAlphas: Record<StageId, number> = { 1: 1, 2: 0, 3: 0 };
  private bgPanWidths: Record<StageId, number> = { 1: 100, 2: 120, 3: 120 };
  private parallaxMidGraphics!: Phaser.GameObjects.Graphics;

  // Dynamic pooled/culled world renderers
  private platformPool: Map<string, Phaser.GameObjects.Container> = new Map();
  private ringPool: Map<string, Phaser.GameObjects.Container> = new Map();
  private snowflakePool: Map<string, Phaser.GameObjects.Image> = new Map();
  private guidePool: Map<string, Phaser.GameObjects.Container> = new Map();

  private wireGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private endingWorldGraphics!: Phaser.GameObjects.Graphics;
  private endingSkyGraphics!: Phaser.GameObjects.Graphics;

  private songiSprite!: Phaser.GameObjects.Sprite;
  private songiBaseScale = 0.315;
  private afterimageTimer = 0;
  private lastFootstepStride = 0;

  // Fixed-capacity particle & popup pools
  private particles: PooledParticle[] = [];
  private afterimages: AfterimageGhost[] = [];
  private popups: FloatingScorePopup[] = [];

  // Title idle demo runner state
  private titleScrollX = 0;

  // Ending & story navigation state
  private endingTriggered = false;
  private isReplayEnding = false;
  private endingPhase: 'ARRIVAL' | 'STORY' = 'ARRIVAL';
  private endingStoryStepIndex = 0;
  private endingElapsed = 0;
  private endingStartRunX = 0;
  private endingSitX = 0;
  private endingFloorY: number = COURSE_BOUNDS.defaultFloorY;
  private endingSnowParticles: EndingSnowParticle[] = [];
  private endingLitCount = 0;
  private endingPlayedArriveChord = false;
  private lastStoryNavAtMs = 0;
  private highScoreSaveCount = 0;
  private badgeSaveCount = 0;

  private hudEmitAccum = 0;

  constructor(
    inputCtrl: UnifiedInputController,
    soundMgr: SoundManager,
    onHudUpdate: (snapshot: HudSnapshot) => void
  ) {
    super({ key: 'GameScene' });
    this.inputCtrl = inputCtrl;
    this.soundMgr = soundMgr;
    this.onHudUpdate = onHudUpdate;
  }

  preload(): void {
    if (!this.textures.exists(TEXTURE_KEYS.songiRaw)) {
      this.load.image(TEXTURE_KEYS.songiRaw, ASSET_PATHS.ninjaSongiSheet);
    }
    if (!this.textures.exists(TEXTURE_KEYS.stage1)) {
      this.load.image(TEXTURE_KEYS.stage1, ASSET_PATHS.stage1Sunheon);
    }
    if (!this.textures.exists(TEXTURE_KEYS.stage2)) {
      this.load.image(TEXTURE_KEYS.stage2, ASSET_PATHS.stage2Myungshin);
    }
    if (!this.textures.exists(TEXTURE_KEYS.stage3)) {
      this.load.image(TEXTURE_KEYS.stage3, ASSET_PATHS.stage3Snowflower);
    }
    if (!this.textures.exists(TEXTURE_KEYS.snowflakeRaw)) {
      this.load.image(TEXTURE_KEYS.snowflakeRaw, ASSET_PATHS.snowflakeIcon);
    }
    if (!this.textures.exists(TEXTURE_KEYS.intro01)) {
      this.load.image(TEXTURE_KEYS.intro01, ASSET_PATHS.intro01);
    }
    if (!this.textures.exists(TEXTURE_KEYS.intro02)) {
      this.load.image(TEXTURE_KEYS.intro02, ASSET_PATHS.intro02);
    }
    if (!this.textures.exists(TEXTURE_KEYS.intro03)) {
      this.load.image(TEXTURE_KEYS.intro03, ASSET_PATHS.intro03);
    }
    if (!this.textures.exists(TEXTURE_KEYS.ending01)) {
      this.load.image(TEXTURE_KEYS.ending01, ASSET_PATHS.ending01);
    }
    if (!this.textures.exists(TEXTURE_KEYS.ending02)) {
      this.load.image(TEXTURE_KEYS.ending02, ASSET_PATHS.ending02);
    }
  }

  create(): void {
    this.prepareProcessedTextures();
    this.setupBackgroundLayers();
    this.setupPoolsAndGraphics();
    this.setupSongiSprite();

    // Expose read-only scene metrics for deterministic automated inspection (invisible to user)
    if (typeof window !== 'undefined') {
      (
        window as unknown as {
          __SONGI_METRICS__?: () => Record<string, unknown>;
        }
      ).__SONGI_METRICS__ = () => ({
        mode: this.mode,
        stageId: this.activeStageId,
        playerX: Math.round(this.player.x),
        playerY: Math.round(this.player.y),
        vx: Math.round(this.player.vx),
        vy: Math.round(this.player.vy),
        onGround: this.player.onGround,
        isSwinging: this.player.isSwinging,
        attachedRingId: this.player.attachedRingId,
        debugEnabled: this.debugEnabled,
        songiVisibleHeightPx: Math.round(
          SPRITE_CONFIG.sourceCharPixelHeight *
            (this.songiSprite.frame.height / SPRITE_CONFIG.normCellHeight) *
            this.songiBaseScale
        ),
        songiScaleRatio: Number(
          (this.songiSprite.scaleX / this.songiSprite.scaleY).toFixed(3)
        ),
        normalSnowflakePx: SNOWFLAKE_DISPLAY.normalDiameterPx,
        goldenSnowflakePx: SNOWFLAKE_DISPLAY.goldenDiameterPx,
        progress: Number(this.maxReachedProgress.toFixed(4)),
        introStepIndex: this.introStepIndex,
        endingPhase: this.endingPhase,
        endingStoryStepIndex: this.endingStoryStepIndex,
        highScoreSaveCount: this.highScoreSaveCount,
        badgeSaveCount: this.badgeSaveCount,
        badgePersisted: loadSnowflowerBadgeUnlocked(),
        storyTexturesLoaded:
          this.textures.exists(TEXTURE_KEYS.intro01) &&
          this.textures.exists(TEXTURE_KEYS.intro02) &&
          this.textures.exists(TEXTURE_KEYS.intro03) &&
          this.textures.exists(TEXTURE_KEYS.ending01) &&
          this.textures.exists(TEXTURE_KEYS.ending02),
      });
    }

    this.sceneCreated = true;
    if (this.pendingStartOptions) {
      const pending = this.pendingStartOptions;
      this.pendingStartOptions = null;
      this.pendingIntroOpen = false;
      this.startRun(pending);
    } else if (this.pendingIntroOpen) {
      this.pendingIntroOpen = false;
      this.enterIntroState();
    } else {
      this.enterReadyState();
    }
  }

  private prepareProcessedTextures(): void {
    const visibleRatio =
      SPRITE_CONFIG.sourceCharPixelHeight / SPRITE_CONFIG.normCellHeight;
    const cellDisplayH = SPRITE_CONFIG.visibleCharHeightPx / visibleRatio;

    if (!this.textures.exists(TEXTURE_KEYS.songiSheet)) {
      const rawTex = this.textures.get(TEXTURE_KEYS.songiRaw);
      const srcImg = rawTex.getSourceImage() as HTMLImageElement;
      const { canvas, frameWidth, frameHeight } =
        buildNormalizedSongiSheet(srcImg);
      this.textures.addSpriteSheet(
        TEXTURE_KEYS.songiSheet,
        canvas as unknown as HTMLImageElement,
        {
          frameWidth,
          frameHeight,
        }
      );
      this.songiBaseScale = cellDisplayH / frameHeight;
    } else {
      const sheetTex = this.textures.get(TEXTURE_KEYS.songiSheet);
      const frame0 = sheetTex.get(0);
      this.songiBaseScale =
        cellDisplayH / (frame0?.height || SPRITE_CONFIG.normCellHeight);
    }

    if (!this.anims.exists('songi_run')) {
      this.anims.create({
        key: 'songi_run',
        frames: this.anims.generateFrameNumbers(TEXTURE_KEYS.songiSheet, {
          start: 0,
          end: 3,
        }),
        frameRate: SPRITE_CONFIG.runBaseFps,
        repeat: -1,
      });
    }

    const rawSf = this.textures
      .get(TEXTURE_KEYS.snowflakeRaw)
      .getSourceImage() as HTMLImageElement;

    // Tightly crop outer transparent margins of snowflake.png so visible artwork fills ~95%
    if (!this.textures.exists(TEXTURE_KEYS.snowflakeNormal)) {
      const normalCanvas = buildNormalSnowflakeCanvas(rawSf, 96);
      this.textures.addCanvas(TEXTURE_KEYS.snowflakeNormal, normalCanvas);
    }

    if (!this.textures.exists(TEXTURE_KEYS.snowflakeGolden)) {
      const goldenCanvas = buildGoldenSnowflakeCanvas(112, rawSf);
      this.textures.addCanvas(TEXTURE_KEYS.snowflakeGolden, goldenCanvas);
    }
  }

  private setupBackgroundLayers(): void {
    const configs: Array<{
      id: StageId;
      key: string;
      targetWidth: number;
      originY: number;
      posY: number;
    }> = [
      {
        id: 1,
        key: TEXTURE_KEYS.stage1,
        targetWidth: 1400,
        originY: 0,
        posY: -115,
      },
      {
        id: 2,
        key: TEXTURE_KEYS.stage2,
        targetWidth: 1430,
        originY: 0.5,
        posY: GAME_HEIGHT * 0.5,
      },
      {
        id: 3,
        key: TEXTURE_KEYS.stage3,
        targetWidth: 1430,
        originY: 0.5,
        posY: GAME_HEIGHT * 0.5,
      },
    ];

    for (const cfg of configs) {
      const img = this.add.image(GAME_WIDTH * 0.5, cfg.posY, cfg.key);
      img.setScrollFactor(0);
      img.setOrigin(0.5, cfg.originY);
      const texW = img.width || 1600;
      const texH = img.height || 900;
      const uniformScale = Math.max(
        cfg.targetWidth / texW,
        (GAME_HEIGHT + 24) / texH
      );
      img.setScale(uniformScale); // Strictly 1:1 uniform scale
      img.setDepth(-20 + cfg.id);
      img.setAlpha(cfg.id === 1 ? 1 : 0);

      this.bgSprites[cfg.id] = img;
      this.bgPanWidths[cfg.id] = Math.max(
        48,
        texW * uniformScale - GAME_WIDTH
      );
    }

    // Faster midground campus architectural/tree parallax layer + breeze streaks for palpable speed!
    this.parallaxMidGraphics = this.add.graphics();
    this.parallaxMidGraphics.setScrollFactor(0);
    this.parallaxMidGraphics.setDepth(-15);

    // Bottom atmospheric gradient band so foreground stone platforms & bottom progress bar read crisply
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(-14);
    vignette.fillGradientStyle(
      0x060d24,
      0x060d24,
      0x060d24,
      0x060d24,
      0,
      0,
      0.46,
      0.46
    );
    vignette.fillRect(0, GAME_HEIGHT - 250, GAME_WIDTH, 250);
  }

  private setupPoolsAndGraphics(): void {
    this.endingSkyGraphics = this.add.graphics();
    this.endingSkyGraphics.setScrollFactor(0);
    this.endingSkyGraphics.setDepth(-12);

    this.endingWorldGraphics = this.add.graphics();
    this.endingWorldGraphics.setDepth(6);

    this.wireGraphics = this.add.graphics();
    this.wireGraphics.setDepth(14);

    this.fxGraphics = this.add.graphics();
    this.fxGraphics.setDepth(22);

    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(45);

    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 4,
      color: 0xffffff,
      alpha: 1,
      gravity: 0,
    }));

    this.afterimages = Array.from({ length: MAX_AFTERIMAGES }, () => {
      const sp = this.add.sprite(-9999, -9999, TEXTURE_KEYS.songiSheet, 6);
      sp.setOrigin(SPRITE_CONFIG.originNormX, SPRITE_CONFIG.originFootNormY);
      sp.setDepth(12);
      sp.setVisible(false);
      sp.setTint(0x7dd3fc);
      return {
        active: false,
        sprite: sp,
        life: 0,
        maxLife: 0.14,
      };
    });

    this.popups = Array.from({ length: MAX_POPUPS }, () => {
      const txt = this.add.text(-9999, -9999, '', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '21px',
        fontStyle: '800',
        color: '#ffffff',
        stroke: '#071438',
        strokeThickness: 4.5,
      });
      txt.setOrigin(0.5, 0.5);
      txt.setDepth(28);
      txt.setVisible(false);
      return {
        active: false,
        textObj: txt,
        life: 0,
        maxLife: 0.62,
        vy: -64,
      };
    });
  }

  private setupSongiSprite(): void {
    this.songiSprite = this.add.sprite(
      COURSE_BOUNDS.startX,
      COURSE_BOUNDS.defaultFloorY,
      TEXTURE_KEYS.songiSheet,
      0
    );
    // Exact foot sole & torso horizontal alignment on normalized 432x528 sheet
    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setScale(this.songiBaseScale); // scaleX === scaleY
    this.songiSprite.setDepth(16);
  }

  // ===========================================================================
  // Public State Control Methods (called cleanly from React / GameController)
  // ===========================================================================

  public enterReadyState(): void {
    this.soundMgr.stopBgm();
    this.cleanupWorldObjects();
    this.inputCtrl.resetEdgesAndState();
    this.mode = 'READY';
    this.introStepIndex = 0;
    this.syncBodyDatasetState('READY');

    this.course = buildMainCourse();
    this.player = createPlayerState(COURSE_BOUNDS.startX, 552, 420);
    this.titleScrollX = 0;
    this.normalCount = 0;
    this.goldenCount = 0;
    this.lockedStats = null;
    this.maxReachedProgress = 0;
    this.smoothedDisplayProgress = 0;
    this.stageBannerText = null;
    this.stageSubBannerText = null;
    this.tutorialHintText = null;
    this.tutorialCompleted = false;
    this.endingTriggered = false;
    this.isReplayEnding = false;

    this.setStageBackgroundImmediate(1);
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;

    this.songiSprite.setVisible(true);
    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setRotation(SPRITE_CONFIG.runForwardLeanRad);
    this.songiSprite.setScale(this.songiBaseScale);
    this.songiSprite.play('songi_run', true);
    this.songiSprite.anims.timeScale = 1.0;

    this.emitHudSnapshot(true);
  }

  public enterIntroState(): void {
    if (!this.sceneCreated) {
      this.pendingIntroOpen = true;
      this.pendingStartOptions = null;
      return;
    }
    this.soundMgr.unlock();
    this.cleanupWorldObjects();
    this.inputCtrl.latchUntilAllReleased();

    this.mode = 'INTRO';
    this.resumeTarget = 'INTRO';
    this.introStepIndex = 0;
    this.lastStoryNavAtMs = performance.now();

    // Keep world, progress, and score strictly frozen at 0 while viewing Intro
    this.course = buildMainCourse();
    this.player = createPlayerState(
      COURSE_BOUNDS.startX,
      COURSE_BOUNDS.defaultFloorY,
      0
    );
    this.normalCount = 0;
    this.goldenCount = 0;
    this.lockedStats = null;
    this.maxReachedProgress = 0;
    this.smoothedDisplayProgress = 0;
    this.stageBannerText = null;
    this.stageSubBannerText = null;
    this.tutorialHintText = null;
    this.tutorialCompleted = false;
    this.endingTriggered = false;
    this.isReplayEnding = false;

    this.setStageBackgroundImmediate(1);
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
    this.songiSprite.anims.stop();
    this.songiSprite.setVisible(false);

    this.soundMgr.startIntroBgm();
    this.syncBodyDatasetState('INTRO');
    this.emitHudSnapshot(true);
  }

  public advanceIntro(): void {
    if (this.mode !== 'INTRO') return;
    const now = performance.now();
    if (now - this.lastStoryNavAtMs < 180) return;
    this.lastStoryNavAtMs = now;

    const res = advanceIntroStep(this.introStepIndex);
    if (res.shouldStartGame) {
      this.soundMgr.playUiClick();
      this.startRun({ tutorial: false });
      return;
    }
    this.introStepIndex = res.nextIndex;
    this.soundMgr.playPageTurn();
    this.emitHudSnapshot(true);
  }

  public rewindIntro(): void {
    if (this.mode !== 'INTRO') return;
    const now = performance.now();
    if (now - this.lastStoryNavAtMs < 180) return;
    this.lastStoryNavAtMs = now;

    const prev = rewindIntroStep(this.introStepIndex);
    if (prev !== this.introStepIndex) {
      this.introStepIndex = prev;
      this.soundMgr.playPageTurn();
      this.emitHudSnapshot(true);
    }
  }

  public skipIntroAndStart(): void {
    if (this.mode !== 'INTRO') return;
    this.soundMgr.playUiClick();
    this.startRun({ tutorial: false });
  }

  public setDevSession(isDev: boolean): void {
    this.isDevSession = isDev;
  }

  public startRun(options?: {
    tutorial?: boolean;
    startStage?: StageId;
    isDevRun?: boolean;
  }): void {
    if (!this.sceneCreated) {
      this.pendingStartOptions = options ?? {};
      this.pendingIntroOpen = false;
      return;
    }
    this.soundMgr.unlock();
    this.cleanupWorldObjects();
    // Latch any held key/pointer from Intro/Menu button clicks so frame 1 never auto-jumps!
    this.inputCtrl.latchUntilAllReleased();

    const isTutorial = Boolean(options?.tutorial);
    this.currentRunId = generateRunId();
    this.currentRunIsDev = Boolean(
      this.isDevSession ||
        options?.isDevRun ||
        (options?.startStage && options.startStage > 1)
    );
    this.course = isTutorial ? buildTutorialCourse() : buildMainCourse();
    this.normalCount = 0;
    this.goldenCount = 0;
    this.lockedStats = null;
    this.lastFailureHint = null;
    this.resetAirborneTelemetry(this.course.startX);
    this.accumulatorSec = 0;
    this.lastFootstepStride = 0;
    this.tutorialCompleted = false;
    this.tutorialRespawnNoticeTimer = 0;
    this.endingTriggered = false;
    this.isReplayEnding = false;
    this.shownStageBanners.clear();

    let spawnX = this.course.startX;
    let spawnY = this.course.startY;
    let initialStage: StageId = 1;

    if (!isTutorial && options?.startStage && options.startStage > 1) {
      initialStage = options.startStage;
      if (initialStage >= 2) this.shownStageBanners.add(1);
      if (initialStage >= 3) this.shownStageBanners.add(2);
      const boundaryX =
        initialStage === 2
          ? this.course.stage1EndX
          : this.course.stage2EndX;
      const plat =
        this.course.platforms.find(
          (p) => p.x <= boundaryX && p.x + p.width >= boundaryX + 200
        ) ??
        this.course.platforms.find(
          (p) => p.x + p.width > boundaryX + 320 && p.width >= 520
        ) ??
        this.course.platforms[0];
      spawnX = Math.max(plat.x + 110, boundaryX);
      spawnY = plat.y;
    }

    const startSpeed = isTutorial
      ? PHYSICS_CONFIG.tutorialRunSpeed
      : STAGE_CONFIGS[initialStage - 1].startSpeed;

    this.player = createPlayerState(spawnX, spawnY, startSpeed);
    this.resetAirborneTelemetry(spawnX);
    const initialProg = computeCourseProgress(
      spawnX,
      this.course.startX,
      this.course.arrivalStartX,
      false
    );
    this.maxReachedProgress = initialProg;
    this.smoothedDisplayProgress = initialProg;

    this.activeStageId = initialStage;
    this.setStageBackgroundImmediate(initialStage);

    if (!isTutorial) {
      this.triggerStageBanner(initialStage);
    } else {
      this.stageBannerText = '연습 코스 · 기본 조작 익히기';
      this.stageSubBannerText = null;
      this.stageBannerTimer = 2.0;
    }

    this.mode = isTutorial ? 'TUTORIAL' : 'RUNNING';
    this.resumeTarget = this.mode;
    this.syncBodyDatasetState(this.mode);

    // Start multi-track Ninja Sprint BGM cleanly
    this.soundMgr.stopBgm();
    this.soundMgr.startMainBgm();

    this.songiSprite.setVisible(true);
    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setRotation(SPRITE_CONFIG.runForwardLeanRad);
    this.songiSprite.setScale(this.songiBaseScale);
    this.songiSprite.setPosition(this.player.x, this.player.y);
    this.songiSprite.play('songi_run', true);
    this.songiSprite.anims.timeScale = 1.0;

    this.currentCameraScreenX = PHYSICS_CONFIG.playerScreenX;
    this.cameras.main.scrollX = this.player.x - this.currentCameraScreenX;
    this.cameras.main.scrollY = 0;

    this.renderMidgroundSpeedParallax(this.cameras.main.scrollX, startSpeed);
    this.syncVisibleWorldObjects();
    this.emitHudSnapshot(true);
  }

  private resetAirborneTelemetry(groundedX: number): void {
    this.airJumpedFromGround = false;
    this.airAttachedRingIds = [];
    this.airLastReleaseDx = null;
    this.airLastReleaseVy = null;
    this.airSawValidRingAfterRelease = false;
    this.airSawInitialOverheadRing = false;
    this.airLastGroundedEdgeX = groundedX;
  }

  public pauseGame(): void {
    if (
      this.mode !== 'RUNNING' &&
      this.mode !== 'TUTORIAL' &&
      this.mode !== 'ENDING'
    ) {
      return;
    }
    this.resumeTarget = this.mode;
    this.mode = 'PAUSED';
    this.soundMgr.pauseBgm();
    this.inputCtrl.resetEdgesAndState();
    if (this.songiSprite.anims.isPlaying) {
      this.songiSprite.anims.pause();
    }
    this.syncBodyDatasetState('PAUSED');
    this.emitHudSnapshot(true);
  }

  public resumeGame(): void {
    if (this.mode !== 'PAUSED') return;
    this.soundMgr.unlock();
    this.inputCtrl.resetEdgesAndState();
    this.accumulatorSec = 0;
    this.mode = this.resumeTarget;
    this.soundMgr.resumeBgm();
    if (
      (this.mode === 'RUNNING' || this.mode === 'TUTORIAL') &&
      this.player.onGround
    ) {
      this.songiSprite.anims.resume();
    }
    this.syncBodyDatasetState(this.mode);
    this.emitHudSnapshot(true);
  }

  public togglePause(): void {
    if (this.mode === 'PAUSED') {
      this.resumeGame();
    } else if (
      this.mode === 'RUNNING' ||
      this.mode === 'TUTORIAL' ||
      this.mode === 'ENDING'
    ) {
      this.pauseGame();
    }
  }

  public handleTabVisibilityChange(hidden: boolean): void {
    if (typeof document !== 'undefined') {
      if (hidden) {
        document.body.dataset.tabhidden = 'true';
      } else {
        delete document.body.dataset.tabhidden;
      }
    }
    if (hidden) {
      if (this.mode === 'RUNNING' || this.mode === 'TUTORIAL') {
        this.pauseGame();
      } else if (this.mode === 'INTRO' || this.mode === 'ENDING') {
        this.soundMgr.pauseBgm();
      }
    } else {
      if (this.mode === 'INTRO' || this.mode === 'ENDING') {
        this.soundMgr.resumeBgm();
      }
    }
  }

  public advanceEndingStory(): void {
    if (this.mode !== 'ENDING' || this.endingPhase !== 'STORY') return;
    const now = performance.now();
    if (now - this.lastStoryNavAtMs < 180) return;
    this.lastStoryNavAtMs = now;

    const res = advanceEndingStoryStep(this.endingStoryStepIndex);
    if (res.shouldShowResult) {
      this.soundMgr.playUiClick();
      this.finishEndingToResult();
      return;
    }
    this.endingStoryStepIndex = res.nextIndex;
    if (this.endingStoryStepIndex === 3) {
      this.soundMgr.playEndingChord('finale');
    } else {
      this.soundMgr.playPageTurn();
    }
    this.emitHudSnapshot(true);
  }

  public replayEnding(): void {
    if (!this.lockedStats) return;
    this.soundMgr.unlock();
    this.beginEndingSequence(true);
  }

  public previewEndingFromDev(forceBonus = false): void {
    this.soundMgr.unlock();
    this.cleanupWorldObjects();
    this.course = buildMainCourse();

    // Mark 0% (0 snowflakes) or ~86% collected on the real course snowflakes to exercise both ending branches
    const total = this.course.snowflakes.length;
    const targetCollect = forceBonus ? Math.ceil(total * 0.86) : 0;
    let nCount = 0;
    let gCount = 0;
    for (let i = 0; i < total; i++) {
      const sf = this.course.snowflakes[i];
      if (i < targetCollect) {
        sf.collected = true;
        if (sf.kind === 'golden') gCount++;
        else nCount++;
      } else {
        sf.collected = false;
      }
    }
    this.currentRunId = generateRunId();
    this.currentRunIsDev = true;
    this.normalCount = nCount;
    this.goldenCount = gCount;

    const arrivalPlat =
      this.course.platforms.find((p) => p.isArrival) ??
      this.course.platforms[this.course.platforms.length - 1];
    this.player = createPlayerState(arrivalPlat.x + 80, arrivalPlat.y, 460);
    this.endingTriggered = false;
    this.syncVisibleWorldObjects();
    this.beginEndingSequence(false);
  }

  public setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (!enabled && this.debugGraphics) {
      this.debugGraphics.clear();
    }
    if (this.sceneCreated) {
      this.emitHudSnapshot(true);
    }
  }

  public toggleDebug(): void {
    this.setDebugEnabled(!this.debugEnabled);
  }

  public refreshHud(): void {
    this.emitHudSnapshot(true);
  }

  // ===========================================================================
  // Main Phaser Update Loop (Fixed Timestep Simulation)
  // ===========================================================================

  update(_time: number, rawDeltaMs: number): void {
    const dtSec = Math.min(
      PHYSICS_CONFIG.maxFrameDeltaSec,
      Math.max(0, rawDeltaMs / 1000)
    );

    if (
      this.mode === 'INTRO' ||
      this.mode === 'PAUSED' ||
      this.mode === 'GAMEOVER' ||
      this.mode === 'RESULT'
    ) {
      return;
    }

    if (this.mode === 'READY') {
      this.updateReadyShowcase(dtSec);
      return;
    }

    if (this.mode === 'ENDING') {
      this.updateEndingSequence(dtSec);
      this.updateVisualPools(dtSec);
      if (this.debugEnabled) this.renderDebugOverlay();
      this.hudEmitAccum += dtSec;
      if (this.hudEmitAccum >= 0.08) {
        this.hudEmitAccum = 0;
        this.emitHudSnapshot(false);
      }
      return;
    }

    // RUNNING or TUTORIAL fixed-timestep simulation
    this.accumulatorSec += dtSec;
    const fixedDt = PHYSICS_CONFIG.fixedDt;
    let substeps = 0;

    while (this.accumulatorSec >= fixedDt && substeps < 8) {
      this.stepGameplayFixed(fixedDt);
      this.accumulatorSec -= fixedDt;
      substeps++;
      if (this.mode !== 'RUNNING' && this.mode !== 'TUTORIAL') {
        break;
      }
    }

    // Update anti-jitter displayProgress from exact world X
    const exactProg = computeCourseProgress(
      this.player.x,
      this.course.startX,
      this.course.arrivalStartX,
      false
    );
    if (exactProg > this.maxReachedProgress) {
      this.maxReachedProgress = exactProg;
    }
    this.smoothedDisplayProgress +=
      (this.maxReachedProgress - this.smoothedDisplayProgress) *
      Math.min(1, dtSec * 14);

    this.updateCameraAndBackgrounds(dtSec);
    this.syncVisibleWorldObjects();
    this.updateSongiVisualPose(dtSec);
    this.renderWireRope();
    this.updateVisualPools(dtSec);

    if (this.stageBannerTimer > 0) {
      this.stageBannerTimer = Math.max(0, this.stageBannerTimer - dtSec);
      if (this.stageBannerTimer <= 0) {
        this.stageBannerText = null;
        this.stageSubBannerText = null;
      }
    }
    if (this.tutorialRespawnNoticeTimer > 0) {
      this.tutorialRespawnNoticeTimer = Math.max(
        0,
        this.tutorialRespawnNoticeTimer - dtSec
      );
    }

    if (this.debugEnabled) {
      this.renderDebugOverlay();
    }

    this.hudEmitAccum += dtSec;
    if (this.hudEmitAccum >= 0.075) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot(false);
    }
  }

  private updateReadyShowcase(dtSec: number): void {
    this.titleScrollX += 270 * dtSec;
    const pan = (Math.sin(this.titleScrollX * 0.0018) + 1) * 0.5;
    const bg1 = this.bgSprites[1];
    if (bg1) {
      bg1.x = GAME_WIDTH * 0.5 + (0.5 - pan) * this.bgPanWidths[1];
    }

    this.renderMidgroundSpeedParallax(this.titleScrollX, 340);

    this.wireGraphics.clear();
    this.endingWorldGraphics.clear();
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;

    this.fxGraphics.clear();
    const floorY = 556;
    this.fxGraphics.fillStyle(0x1e293b, 0.96);
    this.fxGraphics.fillRect(0, floorY, GAME_WIDTH, GAME_HEIGHT - floorY);
    this.fxGraphics.fillStyle(0x475569, 1);
    this.fxGraphics.fillRect(0, floorY, GAME_WIDTH, 24);
    this.fxGraphics.fillStyle(0x003087, 1);
    this.fxGraphics.fillRect(0, floorY, GAME_WIDTH, 10);
    this.fxGraphics.fillStyle(0x38bdf8, 1);
    this.fxGraphics.fillRect(0, floorY, GAME_WIDTH, 3.5);

    const jointOffset = -(this.titleScrollX * 1.0) % 96;
    this.fxGraphics.fillStyle(0x334155, 0.85);
    for (let x = jointOffset; x < GAME_WIDTH + 96; x += 96) {
      this.fxGraphics.fillRect(x, floorY + 10, 2, 36);
    }

    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setRotation(SPRITE_CONFIG.runForwardLeanRad);
    this.songiSprite.setScale(this.songiBaseScale);
    this.songiSprite.setPosition(285, floorY);
    this.songiSprite.play('songi_run', true);
    this.songiSprite.anims.timeScale = 0.95;
  }

  private stepGameplayFixed(dt: number): void {
    const isTutorial = this.mode === 'TUTORIAL';
    const stepInput = this.inputCtrl.consumeStepInput();

    const wasSwingingBeforeStep = this.player.isSwinging;
    const prevRingX = this.player.attachedRingX;

    const events = stepPlayerPhysics(
      this.player,
      dt,
      stepInput,
      this.course.platforms,
      this.course.rings,
      isTutorial
    );

    if (events.jumped) {
      this.airJumpedFromGround = true;
      this.soundMgr.playJump();
      this.spawnDustBurst(this.player.x - 8, this.player.prevY, 6);
    }

    if (events.wireAttached && events.attachedRing) {
      this.airAttachedRingIds.push(events.attachedRing.id);
      this.airSawValidRingAfterRelease = false;
      this.soundMgr.playWireAttach();
      this.spawnRingSparkle(events.attachedRing.x, events.attachedRing.y);
    }

    if (events.wireDetached && wasSwingingBeforeStep) {
      this.airLastReleaseDx = this.player.x - prevRingX;
      this.airLastReleaseVy = this.player.vy;
      this.soundMgr.playWireRelease();
    }

    if (this.player.onGround) {
      this.resetAirborneTelemetry(this.player.x);
    } else if (!this.player.isSwinging) {
      const validNow = findValidRings(this.player, this.course.rings);
      if (validNow.length > 0) {
        if (this.airAttachedRingIds.length === 0) {
          this.airSawInitialOverheadRing = true;
        } else {
          this.airSawValidRingAfterRelease = true;
        }
      }
    }

    if (events.landed && events.landingImpactVy > 110) {
      this.soundMgr.playLand(Math.min(1, events.landingImpactVy / 750));
      this.spawnDustBurst(this.player.x, this.player.y, 6);
    }

    // Footstep sound + short crisp heel dust synced to ground distance
    if (
      this.player.onGround &&
      this.player.strideDistance - this.lastFootstepStride >= 108
    ) {
      this.lastFootstepStride = this.player.strideDistance;
      this.soundMgr.playFootstep(this.player.vx / 460);
      this.spawnRunHeelDust(this.player.x - 16, this.player.y);
    }

    // Collect snowflakes along swept step
    const collected = collectSnowflakesInStep(
      this.player,
      this.course.snowflakes
    );
    for (let i = 0; i < collected.length; i++) {
      const sf = collected[i];
      if (sf.kind === 'golden') {
        this.goldenCount++;
        this.soundMgr.playSnowflake('golden');
        this.spawnSnowflakeBurst(sf.x, sf.y, true);
        this.spawnPopup(
          sf.x,
          sf.y - 18,
          `+${SCORE_CONFIG.goldenSnowflakePoints}`,
          '#fde047'
        );
      } else {
        this.normalCount++;
        this.soundMgr.playSnowflake('normal');
        this.spawnSnowflakeBurst(sf.x, sf.y, false);
        this.spawnPopup(
          sf.x,
          sf.y - 16,
          `+${SCORE_CONFIG.normalSnowflakePoints}`,
          '#e0f2fe'
        );
      }
      const visual = this.snowflakePool.get(sf.id);
      if (visual) {
        visual.destroy();
        this.snowflakePool.delete(sf.id);
      }
    }

    // Stage progression check (Main Game only — BGM keeps looping without interruption!)
    if (!isTutorial) {
      const currentStage = getStageForX(this.player.x).id;
      if (currentStage !== this.activeStageId) {
        this.activeStageId = currentStage;
        this.triggerStageBanner(currentStage);
        this.soundMgr.playStageTransition();
      }
    } else {
      this.updateTutorialHint();
    }

    // Check Arrival on final platform (strictly alive & grounded!)
    if (events.reachedArrival && this.player.onGround && !this.player.isDead) {
      if (isTutorial) {
        this.completeTutorialRun();
      } else if (!this.endingTriggered) {
        this.beginEndingSequence(false);
      }
      return;
    }

    if (
      this.player.onGround &&
      !this.player.isDead &&
      this.player.x >= this.course.arrivalStartX + 40
    ) {
      if (isTutorial) {
        this.completeTutorialRun();
      } else if (!this.endingTriggered) {
        this.beginEndingSequence(false);
      }
      return;
    }

    // Check Fall Out
    if (events.fellOut || this.player.isDead) {
      if (isTutorial) {
        this.recoverTutorialFall();
      } else {
        this.triggerGameOver();
      }
    }
  }

  private updateTutorialHint(): void {
    if (this.tutorialRespawnNoticeTimer > 0) {
      this.tutorialHintText =
        '연습 지점 복귀! 발판 끝에서 점프한 뒤, 공중에서 다시 길게 눌러 고리를 잡으세요!';
      return;
    }
    const px = this.player.x;
    if (px < 2450) {
      this.tutorialHintText =
        '좌클릭 · Space · 화면 터치로 점프해 커다란 눈꽃을 모아보세요';
    } else if (px < 4350) {
      this.tutorialHintText = '작은 틈은 발판 끝에서 점프로 가볍게 넘으세요';
    } else if (px < 5800) {
      this.tutorialHintText =
        '점프 후 손을 뗐다가 공중에서 다시 길게 누르면 빛나는 고리에 와이어가 연결됩니다!';
    } else {
      this.tutorialHintText = '잘했어요! 앞쪽 도착 지점까지 신나게 달려가세요!';
    }
  }

  private recoverTutorialFall(): void {
    const cp = this.course.wireCheckpoint;
    const respawnX =
      cp && this.player.x >= cp.triggerAfterX ? cp.x : this.course.startX;
    const respawnY =
      cp && this.player.x >= cp.triggerAfterX ? cp.y : this.course.startY;

    this.inputCtrl.resetEdgesAndState();
    this.player = createPlayerState(
      respawnX,
      respawnY,
      PHYSICS_CONFIG.tutorialRunSpeed
    );
    const prog = computeCourseProgress(
      respawnX,
      this.course.startX,
      this.course.arrivalStartX,
      false
    );
    this.maxReachedProgress = prog;
    this.smoothedDisplayProgress = prog;
    this.tutorialRespawnNoticeTimer = 3.2;
    this.spawnDustBurst(respawnX, respawnY, 8);
  }

  private completeTutorialRun(): void {
    this.tutorialCompleted = true;
    this.maxReachedProgress = 1;
    this.smoothedDisplayProgress = 1;
    this.inputCtrl.resetEdgesAndState();
    this.soundMgr.fadeOutBgm(0.45);

    const scores = calculateScores(
      this.course.startX,
      this.player.x,
      this.normalCount,
      this.goldenCount
    );
    const sfStats = computeUniqueSnowflakeStats(this.course.snowflakes);
    this.lockedStats = {
      runId: this.currentRunId,
      ruleVersion: GAME_RULE_VERSION,
      ...scores,
      normalCount: sfStats.normalCollected,
      goldenCount: sfStats.goldenCollected,
      totalCourseSnowflakes: sfStats.totalCourseSnowflakes,
      collectedUniqueSnowflakes: sfStats.collectedUniqueSnowflakes,
      collectionRatio: sfStats.collectionRatio,
      collectionPercent: sfStats.collectionPercent,
      earnedSnowflowerBadge: false,
      highScore: this.highScore,
      isNewRecord: false,
      isTutorial: true,
      isDevRun: this.currentRunIsDev,
      cleared: true,
    };
    this.mode = 'RESULT';
    this.syncBodyDatasetState('RESULT');
    this.soundMgr.playStageTransition();
    this.emitHudSnapshot(true);
  }

  private triggerGameOver(): void {
    this.inputCtrl.resetEdgesAndState();
    this.wireGraphics.clear();

    // Freeze exact reached world progress so bottom progress bar shows fail spot
    const failProg = computeCourseProgress(
      this.player.x,
      this.course.startX,
      this.course.arrivalStartX,
      false
    );
    this.maxReachedProgress = Math.max(this.maxReachedProgress, failProg);
    this.smoothedDisplayProgress = this.maxReachedProgress;

    const scores = calculateScores(
      this.course.startX,
      this.player.x,
      this.normalCount,
      this.goldenCount
    );
    const prevHigh = this.highScore;
    const updatedHigh = saveHighScore(scores.totalScore);
    this.highScore = updatedHigh;

    const nextPlatAhead = this.course.platforms.find(
      (p) => p.x > this.airLastGroundedEdgeX + 80
    );
    const chasmEndX = nextPlatAhead ? nextPlatAhead.x : this.player.x + 650;
    const chasmRings = this.course.rings.filter(
      (r) => r.x > this.airLastGroundedEdgeX + 60 && r.x < chasmEndX
    );
    const lastAttachedId =
      this.airAttachedRingIds.length > 0
        ? this.airAttachedRingIds[this.airAttachedRingIds.length - 1]
        : null;
    const lastAttachedRing = lastAttachedId
      ? this.course.rings.find((r) => r.id === lastAttachedId) ?? null
      : null;

    const telemetry: AirborneFailureTelemetry = {
      jumpedFromGround: this.airJumpedFromGround,
      attachedRingCount: this.airAttachedRingIds.length,
      lastReleaseDx: this.airLastReleaseDx,
      lastReleaseVy: this.airLastReleaseVy,
      wasSwingingOrStalledBackward:
        this.player.vx < 110 ||
        (this.airLastReleaseDx !== null &&
          this.airLastReleaseDx > 215 &&
          (this.airLastReleaseVy ?? 0) > -35),
      sawValidUnattachedRingAfterRelease: this.airSawValidRingAfterRelease,
      hasSubsequentChasmRingAhead: Boolean(
        lastAttachedRing &&
          chasmRings.some((r) => r.x > lastAttachedRing.x + 160)
      ),
      chasmHadInitialOverheadRing:
        this.airSawInitialOverheadRing || chasmRings.length > 0,
    };
    this.lastFailureHint = analyzeFailureHint(telemetry);

    const sfStats = computeUniqueSnowflakeStats(this.course.snowflakes);
    this.lockedStats = {
      runId: this.currentRunId,
      ruleVersion: GAME_RULE_VERSION,
      ...scores,
      normalCount: sfStats.normalCollected,
      goldenCount: sfStats.goldenCollected,
      totalCourseSnowflakes: sfStats.totalCourseSnowflakes,
      collectedUniqueSnowflakes: sfStats.collectedUniqueSnowflakes,
      collectionRatio: sfStats.collectionRatio,
      collectionPercent: sfStats.collectionPercent,
      earnedSnowflowerBadge: false,
      highScore: updatedHigh,
      isNewRecord: scores.totalScore > prevHigh && scores.totalScore > 0,
      isTutorial: false,
      isDevRun: this.currentRunIsDev,
      cleared: false,
      failureHint: this.lastFailureHint,
    };

    this.mode = 'GAMEOVER';
    this.syncBodyDatasetState('GAMEOVER');
    this.soundMgr.fadeOutBgm(0.38);
    this.soundMgr.playGameOver();
    this.emitHudSnapshot(true);
  }

  // ===========================================================================
  // Final Arrival & Illumination (~2.6s) -> 2-Scene Story Ending (`ending_01..02`)
  // ===========================================================================

  private beginEndingSequence(isReplay: boolean): void {
    if (!isReplay && (this.endingTriggered || this.player.isDead)) return;
    this.endingTriggered = true;
    this.isReplayEnding = isReplay;
    this.maxReachedProgress = 1;
    this.smoothedDisplayProgress = 1;

    if (!isReplay) {
      const scores = calculateScores(
        this.course.startX,
        this.player.x,
        this.normalCount,
        this.goldenCount
      );
      const sfStats = computeUniqueSnowflakeStats(this.course.snowflakes);
      const prevHigh = this.highScore;
      const updatedHigh = saveHighScore(scores.totalScore);
      this.highScore = updatedHigh;
      this.highScoreSaveCount++;

      if (sfStats.isBonusUnlocked) {
        saveSnowflowerBadgeUnlocked();
        this.badgeSaveCount++;
      }

      this.lockedStats = {
        runId: this.currentRunId,
        ruleVersion: GAME_RULE_VERSION,
        ...scores,
        normalCount: sfStats.normalCollected,
        goldenCount: sfStats.goldenCollected,
        totalCourseSnowflakes: sfStats.totalCourseSnowflakes,
        collectedUniqueSnowflakes: sfStats.collectedUniqueSnowflakes,
        collectionRatio: sfStats.collectionRatio,
        collectionPercent: sfStats.collectionPercent,
        earnedSnowflowerBadge: sfStats.isBonusUnlocked,
        highScore: updatedHigh,
        isNewRecord: scores.totalScore > prevHigh && scores.totalScore > 0,
        isTutorial: false,
        isDevRun: this.currentRunIsDev,
        cleared: true,
      };
    }

    // Stop wire, gameplay input, hazards, and any further spawning
    this.inputCtrl.latchUntilAllReleased();
    this.player.isSwinging = false;
    this.player.attachedRingId = null;
    this.player.onGround = true;
    this.player.vx = 0;
    this.player.vy = 0;
    this.wireGraphics.clear();
    this.parallaxMidGraphics.clear();
    this.stageBannerText = null;
    this.stageSubBannerText = null;
    this.stageBannerTimer = 0;

    // Transition cleanly to calm Snowflower Plaza Ending Lullaby BGM
    this.soundMgr.startEndingBgm();

    this.activeStageId = 3;
    this.setStageBackgroundImmediate(3);

    const arrivalPlat =
      this.course.platforms.find((p) => p.isArrival) ??
      this.course.platforms[this.course.platforms.length - 1];

    this.endingFloorY = arrivalPlat.y;
    if (isReplay) {
      this.player.x = arrivalPlat.x + 80;
      this.player.y = this.endingFloorY;
    }

    this.endingStartRunX = this.player.x;
    this.endingSitX = this.endingStartRunX + 340;

    const expectedArrivalScrollX =
      this.player.x - PHYSICS_CONFIG.playerScreenX;
    if (
      isReplay ||
      Math.abs(this.cameras.main.scrollX - expectedArrivalScrollX) > 600
    ) {
      this.cameras.main.scrollX = expectedArrivalScrollX;
      this.cameras.main.scrollY = 0;
    }

    this.endingPhase = 'ARRIVAL';
    this.endingStoryStepIndex = 0;
    this.endingElapsed = 0;
    this.endingLitCount = 0;
    this.endingPlayedArriveChord = false;
    this.lastStoryNavAtMs = performance.now();

    this.prepareEndingSnowParticles();
    this.syncVisibleWorldObjects();

    this.songiSprite.setVisible(true);
    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setRotation(0);
    this.songiSprite.setScale(this.songiBaseScale);
    this.songiSprite.setPosition(this.player.x, this.player.y);
    this.songiSprite.play('songi_run', true);

    this.mode = 'ENDING';
    this.resumeTarget = 'ENDING';
    this.syncBodyDatasetState('ENDING');
    this.emitHudSnapshot(true);
  }

  private prepareEndingSnowParticles(): void {
    for (const p of this.endingSnowParticles) {
      p.sprite.destroy();
    }
    this.endingSnowParticles = [];

    const stats = this.lockedStats;
    const nCount = stats ? stats.normalCount : this.normalCount;
    const gCount = stats ? stats.goldenCount : this.goldenCount;
    const totalCollected = nCount + gCount;
    if (totalCollected <= 0) {
      return; // 0 collected snowflakes -> decorative stream stays empty (never fabricates collected items)
    }

    const totalParticles = Math.min(
      ENDING_CONFIG.maxEndingSnowflakes,
      Math.max(8, Math.floor(nCount * 0.6 + gCount * 2))
    );
    const goldenParticles = Math.min(
      Math.floor(totalParticles * 0.45),
      gCount * 2
    );

    for (let i = 0; i < totalParticles; i++) {
      const isGolden = i < goldenParticles;
      const sp = this.add.image(
        -9999,
        -9999,
        isGolden ? TEXTURE_KEYS.snowflakeGolden : TEXTURE_KEYS.snowflakeNormal
      );
      sp.setDisplaySize(isGolden ? 26 : 20, isGolden ? 26 : 20);
      sp.setDepth(19);
      sp.setVisible(false);

      const bucket = i % 6;
      let targetX = this.endingSitX + (i - totalParticles * 0.5) * 20;
      let targetY = this.endingFloorY - 135 - (i % 4) * 38;
      if (bucket === 0) {
        targetX = this.endingSitX - 220;
        targetY = this.endingFloorY - 168;
      } else if (bucket === 1) {
        targetX = this.endingSitX - 110;
        targetY = this.endingFloorY - 24;
      } else if (bucket === 2) {
        targetX = this.endingSitX + 115;
        targetY = this.endingFloorY - 24;
      } else if (bucket === 3) {
        targetX = this.endingSitX + 235;
        targetY = this.endingFloorY - 168;
      }

      this.endingSnowParticles.push({
        active: false,
        sprite: sp,
        startX: this.endingStartRunX + 120,
        startY: this.endingFloorY - 68,
        targetX,
        targetY,
        t: -((i / totalParticles) * 0.95),
        speed: 0.95 + (i % 4) * 0.14,
        wobblePhase: i * 1.17,
        isGolden,
      });
    }
  }

  private updateEndingSequence(dt: number): void {
    // Once crossfaded into the 2-scene illustrated Story Ending, wait strictly for button clicks
    if (this.endingPhase === 'STORY') {
      return;
    }

    this.endingElapsed += dt;
    const t = this.endingElapsed;
    const decelDuration = 1.9;
    const u = Math.min(1, t / decelDuration);
    const easeOut = 1 - Math.pow(1 - u, 3);
    const stopX = this.endingSitX - 40;
    const prevX = this.player.x;

    this.player.x =
      this.endingStartRunX + (stopX - this.endingStartRunX) * easeOut;
    this.player.y = this.endingFloorY;

    const stepDist = Math.abs(this.player.x - prevX);
    this.player.strideDistance += stepDist;
    const instSpeed = stepDist / Math.max(0.001, dt);

    if (u < 0.94 && instSpeed > 26) {
      if (!this.songiSprite.anims.isPlaying) {
        this.songiSprite.play('songi_run', true);
      }
      this.songiSprite.anims.timeScale = Math.max(0.35, instSpeed / 440);
      if (this.player.strideDistance - this.lastFootstepStride >= 105) {
        this.lastFootstepStride = this.player.strideDistance;
        this.soundMgr.playFootstep(Math.max(0.3, instSpeed / 460));
      }
      this.songiSprite.setRotation(SPRITE_CONFIG.runForwardLeanRad * (1 - u));
    } else {
      this.songiSprite.anims.stop();
      this.songiSprite.anims.timeScale = 1;
      this.songiSprite.setFrame(0);
      this.songiSprite.setRotation(0);
    }

    if (t >= 0.35 && !this.endingPlayedArriveChord) {
      this.endingPlayedArriveChord = true;
      this.soundMgr.playEndingChord('arrive');
    }

    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setPosition(this.player.x, this.player.y);
    this.songiSprite.setScale(this.songiBaseScale);

    const targetCamX = this.endingSitX - 480;
    const camBlend = Math.min(1, dt * 3.4);
    this.cameras.main.scrollX +=
      (targetCamX - this.cameras.main.scrollX) * camBlend;
    this.cameras.main.scrollY = 0;

    const bg3 = this.bgSprites[3];
    if (bg3) {
      bg3.x = GAME_WIDTH * 0.5 - this.bgPanWidths[3] * 0.45;
    }

    // Short Snowflower Plaza illumination (~0.25s .. 2.6s) before crossfading into ending_01.png
    if (t >= 0.25) {
      const lightPhaseT = t - 0.25;
      const targetLights = Math.min(6, Math.floor(lightPhaseT / 0.3) + 1);
      while (this.endingLitCount < targetLights) {
        this.soundMgr.playEndingLampLight(this.endingLitCount);
        this.endingLitCount++;
      }

      for (let i = 0; i < this.endingSnowParticles.length; i++) {
        const sp = this.endingSnowParticles[i];
        sp.t += dt * sp.speed;
        if (sp.t < 0) continue;
        sp.sprite.setVisible(true);
        sp.startX = this.player.x + 12;
        sp.startY = this.endingFloorY - 68;

        const prog = 1 - Math.pow(1 - Math.min(1, sp.t), 2);
        const arcLift = Math.sin(prog * Math.PI) * 48;
        const wx =
          sp.startX +
          (sp.targetX - sp.startX) * prog +
          Math.sin(t * 2.6 + sp.wobblePhase) * 8;
        const wy = sp.startY + (sp.targetY - sp.startY) * prog - arcLift;
        sp.sprite.setPosition(wx, wy);
        sp.sprite.setAlpha(Math.min(0.95, sp.t * 3));
        sp.sprite.setRotation(t * 1.4 + sp.wobblePhase);
      }
    }

    this.syncVisibleWorldObjects();
    this.renderArrivalPlazaLights(t);

    if (t >= ENDING_CONFIG.arrivalDecelSec) {
      // Cleanly end the world arrival beat and enter the 2-scene Story Ending (no duplicate rest scene!)
      for (const p of this.endingSnowParticles) {
        p.sprite.destroy();
      }
      this.endingSnowParticles = [];
      this.endingWorldGraphics.clear();
      this.endingSkyGraphics.clear();
      this.songiSprite.setVisible(false);

      this.endingPhase = 'STORY';
      this.endingStoryStepIndex = 0;
      this.lastStoryNavAtMs = performance.now();
      this.soundMgr.playEndingChord('rest');
      this.emitHudSnapshot(true);
    }
  }

  private renderArrivalPlazaLights(t: number): void {
    this.endingWorldGraphics.clear();
    this.endingSkyGraphics.clear();

    const sitX = this.endingSitX;
    const floorY = this.endingFloorY;
    const streetLamps = [sitX - 220, sitX + 235];
    const groundBollards = [sitX - 310, sitX - 110, sitX + 115, sitX + 315];

    streetLamps.forEach((lx, idx) => {
      this.endingWorldGraphics.fillStyle(0x1e293b, 1);
      this.endingWorldGraphics.fillRect(lx - 10, floorY - 10, 20, 10);
      this.endingWorldGraphics.fillStyle(0x334155, 1);
      this.endingWorldGraphics.fillRect(lx - 3, floorY - 160, 6, 150);
      this.endingWorldGraphics.fillStyle(0x0f172a, 1);
      this.endingWorldGraphics.fillRoundedRect(
        lx - 13,
        floorY - 180,
        26,
        22,
        5
      );

      const isLit = this.endingLitCount > idx * 2;
      if (isLit) {
        const warmPulse = 0.85 + 0.15 * Math.sin(t * 3 + idx);
        this.endingWorldGraphics.fillStyle(0xfef08a, 0.95);
        this.endingWorldGraphics.fillRoundedRect(
          lx - 9,
          floorY - 176,
          18,
          14,
          3
        );
        this.endingWorldGraphics.fillStyle(0xfde047, 0.2 * warmPulse);
        this.endingWorldGraphics.fillCircle(lx, floorY - 168, 52);
        this.endingWorldGraphics.fillStyle(0x38bdf8, 0.11 * warmPulse);
        this.endingWorldGraphics.fillCircle(lx, floorY - 168, 92);
      } else {
        this.endingWorldGraphics.fillStyle(0x475569, 0.65);
        this.endingWorldGraphics.fillRoundedRect(
          lx - 9,
          floorY - 176,
          18,
          14,
          3
        );
      }
    });

    groundBollards.forEach((bx, idx) => {
      this.endingWorldGraphics.fillStyle(0x334155, 1);
      this.endingWorldGraphics.fillRoundedRect(bx - 6, floorY - 24, 12, 24, 3);
      const isLit = this.endingLitCount >= idx + 2;
      if (isLit) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 3.4 + idx * 1.3);
        this.endingWorldGraphics.fillStyle(0xe0f2fe, 0.95);
        this.endingWorldGraphics.fillRect(bx - 4, floorY - 20, 8, 11);
        this.endingWorldGraphics.fillStyle(0x7dd3fc, 0.22 * pulse);
        this.endingWorldGraphics.fillCircle(bx, floorY - 15, 34);
      } else {
        this.endingWorldGraphics.fillStyle(0x64748b, 0.5);
        this.endingWorldGraphics.fillRect(bx - 4, floorY - 20, 8, 11);
      }
    });
  }

  private finishEndingToResult(): void {
    for (const p of this.endingSnowParticles) {
      p.sprite.destroy();
    }
    this.endingSnowParticles = [];
    this.endingWorldGraphics.clear();
    this.endingSkyGraphics.clear();
    this.soundMgr.fadeOutBgm(0.55);

    this.mode = 'RESULT';
    this.syncBodyDatasetState('RESULT');
    this.emitHudSnapshot(true);
  }

  // ===========================================================================
  // Camera, Multi-Plane Speed Parallax, World Object Pooling & Visual FX
  // ===========================================================================

  private setStageBackgroundImmediate(stageId: StageId): void {
    ([1, 2, 3] as StageId[]).forEach((id) => {
      const target = id === stageId ? 1 : 0;
      this.bgAlphas[id] = target;
      this.bgSprites[id]?.setAlpha(target);
    });
  }

  private triggerStageBanner(stageId: StageId): void {
    if (this.shownStageBanners.has(stageId)) return;
    this.shownStageBanners.add(stageId);
    const stage = STAGE_CONFIGS[stageId - 1];
    this.stageBannerText = stage.bannerTitle;
    this.stageSubBannerText = stageId === 1 ? STAGE1_STORY_CALLOUT : null;
    this.stageBannerTimer = stageId === 1 ? 3.0 : ENDING_CONFIG.stageBannerSec;
  }

  private updateCameraAndBackgrounds(dtSec: number): void {
    // Velocity-aware forward camera lookahead: expands from 1,005px ahead (275px screenX)
    // up to 1,065px ahead (215px screenX) during fast Stage 2/3 sprints & wire swings!
    const forwardSpeed = Math.max(450, this.player.vx);
    const speedFactor = Math.max(0, Math.min(1, (forwardSpeed - 465) / 260));
    const targetScreenX =
      PHYSICS_CONFIG.playerScreenX -
      (PHYSICS_CONFIG.playerScreenX - PHYSICS_CONFIG.minPlayerScreenX) *
        speedFactor;
    this.currentCameraScreenX +=
      (targetScreenX - this.currentCameraScreenX) * Math.min(1, dtSec * 3.8);

    this.cameras.main.scrollX = this.player.x - this.currentCameraScreenX;
    this.cameras.main.scrollY = 0;

    // 1. Far background Stage 1/2/3 crossfade & slow gentle pan
    const fadeSpeed = 1 / ENDING_CONFIG.crossfadeBgSec;
    ([1, 2, 3] as StageId[]).forEach((id) => {
      const target = id === this.activeStageId ? 1 : 0;
      if (this.bgAlphas[id] < target) {
        this.bgAlphas[id] = Math.min(
          target,
          this.bgAlphas[id] + fadeSpeed * dtSec
        );
      } else if (this.bgAlphas[id] > target) {
        this.bgAlphas[id] = Math.max(
          target,
          this.bgAlphas[id] - fadeSpeed * dtSec
        );
      }

      const bg = this.bgSprites[id];
      if (!bg) return;
      bg.setAlpha(this.bgAlphas[id]);

      if (this.bgAlphas[id] > 0.001) {
        const stCfg = STAGE_CONFIGS[id - 1];
        const span = Math.max(1, stCfg.endX - stCfg.startX);
        const localProgress =
          this.mode === 'TUTORIAL'
            ? Math.min(1, Math.max(0, this.player.x / this.course.totalEndX))
            : Math.min(1, Math.max(0, (this.player.x - stCfg.startX) / span));

        const panW = this.bgPanWidths[id];
        bg.x = GAME_WIDTH * 0.5 + (0.5 - localProgress) * panW;
      }
    });

    // 2. Faster midground campus silhouettes & moonlit speed breeze lines
    const speedMag = Math.hypot(this.player.vx, this.player.vy * 0.35);
    this.renderMidgroundSpeedParallax(this.cameras.main.scrollX, speedMag);
  }

  /**
   * Renders a multi-speed midground parallax layer (campus rooftop silhouettes, distant warm lamp posts,
   * and subtle high-speed breeze streaks) scrolling faster than the distant campus painting so
   * 460 -> 540 -> 620 px/s velocity feels lively without shaking or cluttering platforms.
   */
  private renderMidgroundSpeedParallax(
    scrollX: number,
    currentSpeed: number
  ): void {
    const g = this.parallaxMidGraphics;
    g.clear();

    // Midground silhouette band (scrolls at 0.36x world camera speed)
    const midTileW = 420;
    const midOffset = -((scrollX * 0.36) % midTileW);
    for (let baseX = midOffset - midTileW; baseX < GAME_WIDTH + midTileW; baseX += midTileW) {
      // Distant campus balustrade & treetop silhouettes along lower horizon
      g.fillStyle(0x0b193d, 0.42);
      g.fillRoundedRect(baseX + 24, 520, 170, 200, 6);
      g.fillCircle(baseX + 265, 538, 46);
      g.fillCircle(baseX + 312, 548, 38);

      // Subtle campus iron streetlamp silhouette in midground
      const lampX = baseX + 372;
      g.fillStyle(0x0f2350, 0.52);
      g.fillRect(lampX - 2, 462, 4, 140);
      g.fillStyle(0xfef08a, 0.16);
      g.fillCircle(lampX, 458, 12);
      g.fillStyle(0xfef08a, 0.55);
      g.fillCircle(lampX, 458, 3.5);
    }

    // Subtle moonlit air-stream streaks scrolling at 0.72x when running fast (> 440 px/s)
    const streakAlpha = Math.max(
      0,
      Math.min(0.22, (currentSpeed - 410) / 1200)
    );
    if (streakAlpha > 0.01) {
      const windSpan = 520;
      const windScroll = scrollX * 0.72;
      g.lineStyle(1.6, 0xbae6fd, streakAlpha);
      const streakRows = [148, 236, 328, 418];
      for (let r = 0; r < streakRows.length; r++) {
        const sy = streakRows[r];
        const rowShift = -((windScroll + r * 173) % windSpan);
        for (let wx = rowShift; wx < GAME_WIDTH + 120; wx += windSpan) {
          const len = 46 + (r % 2) * 22;
          g.beginPath();
          g.moveTo(wx, sy);
          g.lineTo(wx + len, sy);
          g.strokePath();
        }
      }
    }
  }

  private updateSongiVisualPose(dtSec: number): void {
    this.songiSprite.setOrigin(
      SPRITE_CONFIG.originNormX,
      SPRITE_CONFIG.originFootNormY
    );
    this.songiSprite.setPosition(this.player.x, this.player.y);

    // Visual-only squash & stretch around base uniform scale (never touches collider!)
    const squash = this.player.landingSquash;
    const stretch = this.player.jumpStretch;
    const sx =
      this.songiBaseScale * (1 + squash * 0.11 - stretch * 0.06);
    const sy =
      this.songiBaseScale * (1 - squash * 0.1 + stretch * 0.09);
    this.songiSprite.setScale(sx, sy);

    if (this.player.isSwinging) {
      if (this.songiSprite.anims.isPlaying) {
        this.songiSprite.anims.stop();
      }
      this.songiSprite.setFrame(6);

      const dx = this.player.x - this.player.attachedRingX;
      const dy = this.player.y - 70 - this.player.attachedRingY;
      const swingAngle = Math.atan2(dx, Math.max(45, dy));
      this.songiSprite.setRotation(
        Math.max(-0.36, Math.min(0.36, -swingAngle * 0.45))
      );
    } else if (!this.player.onGround) {
      if (this.songiSprite.anims.isPlaying) {
        this.songiSprite.anims.stop();
      }
      this.songiSprite.setRotation(
        Math.max(-0.13, Math.min(0.15, this.player.vy * 0.00016))
      );
      if (this.player.vy < -35) {
        this.songiSprite.setFrame(4);
      } else {
        this.songiSprite.setFrame(5);
      }
    } else {
      // Energetic slight forward lean while sprinting on ground
      this.songiSprite.setRotation(SPRITE_CONFIG.runForwardLeanRad);
      if (!this.songiSprite.anims.isPlaying) {
        this.songiSprite.play('songi_run', true);
      }
      this.songiSprite.anims.timeScale = Math.max(
        0.88,
        Math.min(1.42, this.player.vx / 460)
      );
    }

    // Light, short afterimage only during wire swing or high-speed launch (> 600 px/s)
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (this.player.isSwinging || (!this.player.onGround && speed > 600)) {
      this.afterimageTimer += dtSec;
      if (this.afterimageTimer >= 0.06) {
        this.afterimageTimer = 0;
        this.spawnAfterimage();
      }
    } else {
      this.afterimageTimer = 0;
    }
  }

  private getSongiWireHandWorldPos(): { x: number; y: number } {
    const frameTex = this.songiSprite.frame;
    const fw = frameTex?.width || SPRITE_CONFIG.normCellWidth;
    const fh = frameTex?.height || SPRITE_CONFIG.normCellHeight;

    const localDx =
      (SPRITE_CONFIG.wireHandNormX - SPRITE_CONFIG.originNormX) *
      fw *
      this.songiSprite.scaleX;
    const localDy =
      (SPRITE_CONFIG.wireHandNormY - SPRITE_CONFIG.originFootNormY) *
      fh *
      this.songiSprite.scaleY;

    const cos = Math.cos(this.songiSprite.rotation);
    const sin = Math.sin(this.songiSprite.rotation);

    return {
      x: this.songiSprite.x + localDx * cos - localDy * sin,
      y: this.songiSprite.y + localDx * sin + localDy * cos,
    };
  }

  private renderWireRope(): void {
    this.wireGraphics.clear();
    if (!this.player.isSwinging) return;

    const hand = this.getSongiWireHandWorldPos();
    const rx = this.player.attachedRingX;
    const ry = this.player.attachedRingY;

    this.wireGraphics.lineStyle(5.5, 0x38bdf8, 0.35);
    this.wireGraphics.beginPath();
    this.wireGraphics.moveTo(hand.x, hand.y);
    this.wireGraphics.lineTo(rx, ry);
    this.wireGraphics.strokePath();

    this.wireGraphics.lineStyle(2.6, 0xe0f2fe, 0.96);
    this.wireGraphics.beginPath();
    this.wireGraphics.moveTo(hand.x, hand.y);
    this.wireGraphics.lineTo(rx, ry);
    this.wireGraphics.strokePath();

    this.wireGraphics.fillStyle(0xfde047, 1);
    this.wireGraphics.fillCircle(rx, ry, 5.5);
    this.wireGraphics.fillStyle(0xe0f2fe, 1);
    this.wireGraphics.fillCircle(hand.x, hand.y, 3.8);
  }

  private syncVisibleWorldObjects(): void {
    const viewLeft = this.cameras.main.scrollX - 300;
    const viewRight = this.cameras.main.scrollX + GAME_WIDTH + 520;

    // 1. Platforms
    const activePlatIds = new Set<string>();
    for (let i = 0; i < this.course.platforms.length; i++) {
      const p = this.course.platforms[i];
      if (p.x + p.width < viewLeft || p.x > viewRight) continue;
      activePlatIds.add(p.id);
      if (!this.platformPool.has(p.id)) {
        this.platformPool.set(p.id, this.createPlatformVisual(p));
      }
    }
    for (const [id, obj] of this.platformPool.entries()) {
      if (!activePlatIds.has(id)) {
        obj.destroy();
        this.platformPool.delete(id);
      }
    }

    // 2. Grapple Rings
    const validRings =
      this.mode === 'RUNNING' || this.mode === 'TUTORIAL'
        ? findValidRings(this.player, this.course.rings)
        : [];
    const validIds = new Set(validRings.map((r) => r.id));
    const bestRing =
      this.mode === 'RUNNING' || this.mode === 'TUTORIAL'
        ? selectBestRing(this.player, this.course.rings)
        : null;

    const activeRingIds = new Set<string>();
    for (let i = 0; i < this.course.rings.length; i++) {
      const r = this.course.rings[i];
      if (r.x < viewLeft || r.x > viewRight) continue;
      activeRingIds.add(r.id);

      let container = this.ringPool.get(r.id);
      if (!container) {
        container = this.createRingVisual(r);
        this.ringPool.set(r.id, container);
      }
      const isFirstBeacon =
        Boolean(r.isFirstHighlight) &&
        r.x - this.player.x > -30 &&
        r.x - this.player.x < 880;

      this.updateRingVisualState(
        container,
        this.player.attachedRingId === r.id,
        validIds.has(r.id),
        bestRing?.id === r.id,
        isFirstBeacon
      );
    }
    for (const [id, obj] of this.ringPool.entries()) {
      if (!activeRingIds.has(id)) {
        obj.destroy();
        this.ringPool.delete(id);
      }
    }

    // 3. Snowflakes (43px normal / 56px golden tight-cropped visible diameters!)
    const activeSfIds = new Set<string>();
    if (this.mode !== 'ENDING') {
      const bobPhase = this.time.now * 0.0042;
      for (let i = 0; i < this.course.snowflakes.length; i++) {
        const sf = this.course.snowflakes[i];
        if (sf.collected) continue;
        if (sf.x < viewLeft || sf.x > viewRight) continue;
        activeSfIds.add(sf.id);

        let img = this.snowflakePool.get(sf.id);
        if (!img) {
          img = this.createSnowflakeVisual(sf);
          this.snowflakePool.set(sf.id, img);
        }
        const bob = Math.sin(bobPhase + sf.x * 0.012) * 4.0;
        img.y = sf.y + bob;
        if (sf.kind === 'golden') {
          img.rotation = Math.sin(bobPhase * 0.75 + sf.x * 0.01) * 0.2;
        }
      }
    }
    for (const [id, obj] of this.snowflakePool.entries()) {
      if (!activeSfIds.has(id)) {
        obj.destroy();
        this.snowflakePool.delete(id);
      }
    }

    // 4. In-world Tutorial / Opening Guide Boards
    const activeGuideIds = new Set<string>();
    if (this.mode === 'TUTORIAL' || this.mode === 'RUNNING') {
      for (let i = 0; i < this.course.guides.length; i++) {
        const g = this.course.guides[i];
        if (g.x + 280 < viewLeft || g.x - 280 > viewRight) continue;
        activeGuideIds.add(g.id);
        if (!this.guidePool.has(g.id)) {
          this.guidePool.set(
            g.id,
            this.createGuideVisual(g.x, g.y, g.title, g.subtitle)
          );
        }
      }
    }
    for (const [id, obj] of this.guidePool.entries()) {
      if (!activeGuideIds.has(id)) {
        obj.destroy();
        this.guidePool.delete(id);
      }
    }
  }

  private createPlatformVisual(p: PlatformDef): Phaser.GameObjects.Container {
    const container = this.add.container(p.x, p.y);
    container.setDepth(5);
    const g = this.add.graphics();
    const h = GAME_HEIGHT - p.y + 80;

    g.fillStyle(0x1e293b, 0.97);
    g.fillRect(0, 10, p.width, h);

    g.fillStyle(0x475569, 1);
    g.fillRect(0, 10, p.width, 32);

    g.fillStyle(0x64748b, 1);
    g.fillRect(2, 12, Math.max(0, p.width - 4), 15);

    g.fillStyle(0x334155, 0.85);
    for (let bx = 64; bx < p.width - 20; bx += 64) {
      g.fillRect(bx, 11, 2, 30);
    }
    for (let pil = 160; pil < p.width - 80; pil += 220) {
      g.fillStyle(0x334155, 0.7);
      g.fillRect(pil - 10, 42, 20, h - 42);
    }

    g.fillStyle(0x003087, 1);
    g.fillRoundedRect(-2, 0, p.width + 4, 12, 3);

    g.fillStyle(p.isArrival ? 0xfde047 : 0x38bdf8, 1);
    g.fillRect(0, 0, p.width, 4.8);

    g.fillStyle(0xf0f9ff, 0.95);
    g.fillRect(1, 0, Math.max(0, p.width - 2), 2);

    // Subtle decorative cat paw-print trail left by Meokbabi near rooftop takeoff edges (purely visual, zero collision)
    if (!p.isArrival && p.width >= 420) {
      const pawPositions = [
        { x: p.width - 122, y: 21 },
        { x: p.width - 74, y: 19 },
      ];
      for (const pos of pawPositions) {
        g.fillStyle(0xbae6fd, 0.58);
        g.fillEllipse(pos.x, pos.y + 2.5, 7.5, 5.5);
        g.fillCircle(pos.x - 4.2, pos.y - 2.2, 1.9);
        g.fillCircle(pos.x, pos.y - 3.6, 2.0);
        g.fillCircle(pos.x + 4.2, pos.y - 2.2, 1.9);
      }
    }

    container.add(g);
    return container;
  }

  private createRingVisual(r: RingDef): Phaser.GameObjects.Container {
    const container = this.add.container(r.x, r.y);
    container.setDepth(13);

    const beacon = this.add.graphics();
    const halo = this.add.graphics();
    const base = this.add.graphics();
    const reticle = this.add.graphics();

    base.lineStyle(5.5, 0x071438, 0.96);
    base.strokeCircle(0, 0, 20);
    base.lineStyle(4, 0x94a3b8, 1);
    base.strokeCircle(0, 0, 18);
    base.fillStyle(0x003087, 1);
    base.fillCircle(0, 0, 10);
    base.fillStyle(0xe2e8f0, 1);
    base.fillCircle(0, 0, 4.5);

    reticle.lineStyle(3.0, 0xfde047, 0.98);
    const b = 30;
    const len = 9.5;
    reticle.beginPath();
    reticle.moveTo(-b, -b + len);
    reticle.lineTo(-b, -b);
    reticle.lineTo(-b + len, -b);
    reticle.moveTo(b - len, -b);
    reticle.lineTo(b, -b);
    reticle.lineTo(b, -b + len);
    reticle.moveTo(-b, b - len);
    reticle.lineTo(-b, b);
    reticle.lineTo(-b + len, b);
    reticle.moveTo(b - len, b);
    reticle.lineTo(b, b);
    reticle.lineTo(b, b - len);
    reticle.strokePath();
    reticle.setVisible(false);

    const children: Phaser.GameObjects.GameObject[] = [
      beacon,
      halo,
      base,
      reticle,
    ];
    if (r.isFirstHighlight) {
      const callout = this.add.text(0, -44, '와이어!', {
        fontFamily: '"Noto Sans KR", sans-serif',
        fontSize: '14px',
        fontStyle: '900',
        color: '#fde047',
        stroke: '#061234',
        strokeThickness: 4,
      });
      callout.setOrigin(0.5, 0.5);
      callout.setVisible(false);
      children.push(callout);
      container.setData('callout', callout);
    }

    container.add(children);
    container.setData('beacon', beacon);
    container.setData('halo', halo);
    container.setData('reticle', reticle);
    container.setData('stateKey', '');
    return container;
  }

  private updateRingVisualState(
    container: Phaser.GameObjects.Container,
    isAttached: boolean,
    isValid: boolean,
    isBest: boolean,
    isFirstBeacon: boolean
  ): void {
    const reticle = container.getData('reticle') as Phaser.GameObjects.Graphics;
    const halo = container.getData('halo') as Phaser.GameObjects.Graphics;
    const beacon = container.getData('beacon') as Phaser.GameObjects.Graphics;
    const callout = container.getData('callout') as
      | Phaser.GameObjects.Text
      | undefined;

    const nextStateKey = `${isAttached ? 1 : 0}_${isValid ? 1 : 0}_${isBest ? 1 : 0}_${isFirstBeacon ? 1 : 0}`;

    if (container.getData('stateKey') !== nextStateKey) {
      container.setData('stateKey', nextStateKey);
      halo.clear();

      if (isAttached) {
        halo.fillStyle(0x38bdf8, 0.4);
        halo.fillCircle(0, 0, 36);
        halo.lineStyle(3.4, 0xfde047, 1);
        halo.strokeCircle(0, 0, 23);
      } else if (isBest) {
        // Bright high-contrast glow on primary connectable forward ring
        halo.fillStyle(0xfde047, 0.24);
        halo.fillCircle(0, 0, 44);
        halo.fillStyle(0x38bdf8, 0.36);
        halo.fillCircle(0, 0, 33);
        halo.lineStyle(3.6, 0xfef08a, 1);
        halo.strokeCircle(0, 0, 24);
      } else if (isValid) {
        halo.fillStyle(0x38bdf8, 0.28);
        halo.fillCircle(0, 0, 34);
        halo.lineStyle(2.8, 0x7dd3fc, 0.94);
        halo.strokeCircle(0, 0, 22);
      } else if (isFirstBeacon) {
        halo.fillStyle(0xfde047, 0.16);
        halo.fillCircle(0, 0, 34);
        halo.lineStyle(2.4, 0xfde047, 0.82);
        halo.strokeCircle(0, 0, 23);
      }
      reticle.setVisible(isBest && !isAttached);
      if (callout) {
        callout.setVisible(isFirstBeacon && !isAttached);
      }
    }

    beacon.clear();
    if (isFirstBeacon && !isAttached) {
      const wave = (this.time.now * 0.0018) % 1;
      const rWave = 26 + wave * 32;
      beacon.lineStyle(2.5, 0xfde047, (1 - wave) * 0.85);
      beacon.strokeCircle(0, 0, rWave);
      if (callout) {
        callout.y = -44 + Math.sin(this.time.now * 0.007) * 3.5;
      }
    }

    if (isBest && !isAttached) {
      const pulse = 1 + Math.sin(this.time.now * 0.012) * 0.09;
      reticle.setScale(pulse);
      reticle.rotation += 0.024;
    }
  }

  private createSnowflakeVisual(sf: SnowflakeDef): Phaser.GameObjects.Image {
    const isGolden = sf.kind === 'golden';
    const img = this.add.image(
      sf.x,
      sf.y,
      isGolden ? TEXTURE_KEYS.snowflakeGolden : TEXTURE_KEYS.snowflakeNormal
    );
    // Tight-cropped textures (~95% fill) -> visible snowflower drawing is ~41-43px normal & ~53-56px golden!
    const size = isGolden
      ? SNOWFLAKE_DISPLAY.goldenDiameterPx
      : SNOWFLAKE_DISPLAY.normalDiameterPx;
    img.setDisplaySize(size, size);
    img.setDepth(isGolden ? 12 : 11);
    return img;
  }

  private createGuideVisual(
    x: number,
    y: number,
    title: string,
    subtitle: string
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    c.setDepth(8);

    const bg = this.add.graphics();
    bg.fillStyle(0x071438, 0.86);
    bg.fillRoundedRect(-220, -35, 440, 70, 10);
    bg.lineStyle(1.6, 0x38bdf8, 0.7);
    bg.strokeRoundedRect(-220, -35, 440, 70, 10);

    const t1 = this.add.text(0, -13, title, {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: '16px',
      fontStyle: '800',
      color: '#fde047',
    });
    t1.setOrigin(0.5, 0.5);

    const t2 = this.add.text(0, 13, subtitle, {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: '13.5px',
      fontStyle: '600',
      color: '#f8fafc',
    });
    t2.setOrigin(0.5, 0.5);

    c.add([bg, t1, t2]);
    return c;
  }

  // ===========================================================================
  // Pooled Particles, Heel Dust, Afterimages, Score Popups & Debug Overlay
  // ===========================================================================

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: number,
    gravity = 0
  ): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.life = life;
        p.maxLife = life;
        p.size = size;
        p.color = color;
        p.alpha = 1;
        p.gravity = gravity;
        return;
      }
    }
  }

  private spawnRunHeelDust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      this.spawnParticle(
        x + (Math.random() - 0.5) * 10,
        y - 3,
        -85 - Math.random() * 65,
        -18 - Math.random() * 28,
        0.18 + Math.random() * 0.08,
        3.2 + Math.random() * 1.8,
        i === 0 ? 0xe0f2fe : 0xcbd5e1,
        120
      );
    }
  }

  private spawnDustBurst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.PI + (Math.random() - 0.5) * 1.3;
      const spd = 45 + Math.random() * 85;
      this.spawnParticle(
        x + (Math.random() - 0.5) * 20,
        y - 3,
        Math.cos(ang) * spd - 45,
        -Math.abs(Math.sin(ang) * spd) - 22,
        0.26 + Math.random() * 0.14,
        3.5 + Math.random() * 2.2,
        0xe2e8f0,
        190
      );
    }
  }

  private spawnRingSparkle(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const spd = 80 + Math.random() * 70;
      this.spawnParticle(
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        0.32,
        3.8,
        i % 2 === 0 ? 0xfde047 : 0x7dd3fc,
        0
      );
    }
  }

  private spawnSnowflakeBurst(x: number, y: number, isGolden: boolean): void {
    const count = isGolden ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = (isGolden ? 105 : 75) + Math.random() * 60;
      this.spawnParticle(
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        isGolden ? 0.44 : 0.32,
        isGolden ? 4.4 : 3.4,
        isGolden ? (i % 2 === 0 ? 0xfde047 : 0xfffbeb) : 0x7dd3fc,
        65
      );
    }
  }

  private spawnAfterimage(): void {
    for (let i = 0; i < this.afterimages.length; i++) {
      const ghost = this.afterimages[i];
      if (!ghost.active) {
        ghost.active = true;
        ghost.life = 0.14;
        ghost.maxLife = 0.14;
        ghost.sprite.setFrame(this.songiSprite.frame.name);
        ghost.sprite.setPosition(this.songiSprite.x, this.songiSprite.y);
        ghost.sprite.setScale(this.songiSprite.scaleX, this.songiSprite.scaleY);
        ghost.sprite.setRotation(this.songiSprite.rotation);
        ghost.sprite.setAlpha(0.22);
        ghost.sprite.setVisible(true);
        return;
      }
    }
  }

  private spawnPopup(x: number, y: number, label: string, color: string): void {
    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) {
        pop.active = true;
        pop.life = 0.62;
        pop.maxLife = 0.62;
        pop.textObj.setText(label);
        pop.textObj.setColor(color);
        pop.textObj.setPosition(x, y);
        pop.textObj.setAlpha(1);
        pop.textObj.setVisible(true);
        return;
      }
    }
  }

  private updateVisualPools(dtSec: number): void {
    this.fxGraphics.clear();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dtSec;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      const ratio = p.life / p.maxLife;
      this.fxGraphics.fillStyle(p.color, ratio * 0.9);
      this.fxGraphics.fillCircle(p.x, p.y, p.size * (0.45 + ratio * 0.55));
    }

    for (let i = 0; i < this.afterimages.length; i++) {
      const g = this.afterimages[i];
      if (!g.active) continue;
      g.life -= dtSec;
      if (g.life <= 0) {
        g.active = false;
        g.sprite.setVisible(false);
        continue;
      }
      g.sprite.setAlpha((g.life / g.maxLife) * 0.22);
    }

    for (let i = 0; i < this.popups.length; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life -= dtSec;
      if (pop.life <= 0) {
        pop.active = false;
        pop.textObj.setVisible(false);
        continue;
      }
      pop.textObj.y += pop.vy * dtSec;
      pop.textObj.setAlpha(Math.min(1, (pop.life / pop.maxLife) * 1.4));
    }
  }

  private renderDebugOverlay(): void {
    this.debugGraphics.clear();

    // 1. Player torso/feet physics collider (44x68)
    const cw = PHYSICS_CONFIG.colliderWidth;
    const ch = PHYSICS_CONFIG.colliderHeight;
    this.debugGraphics.lineStyle(2, 0x22c55e, 0.95);
    this.debugGraphics.strokeRect(
      this.player.x - cw * 0.5,
      this.player.y - ch,
      cw,
      ch
    );

    // 2. Grapple origin & 475px wire range circle + Each visible ring's approach sector!
    const gx = this.player.x + PHYSICS_CONFIG.grappleOriginOffsetX;
    const gy = this.player.y + PHYSICS_CONFIG.grappleOriginOffsetY;
    this.debugGraphics.lineStyle(1.5, 0x38bdf8, 0.45);
    this.debugGraphics.strokeCircle(gx, gy, PHYSICS_CONFIG.maxWireRange);

    const bestRing = selectBestRing(this.player, this.course.rings);
    for (const r of this.course.rings) {
      if (
        r.x < this.cameras.main.scrollX - 480 ||
        r.x > this.cameras.main.scrollX + GAME_WIDTH + 480
      ) {
        continue;
      }
      const isTarget = bestRing?.id === r.id;
      // Draw ring's lower-left valid grapple reach sector (angles PI*0.5 to PI in screen Y-down coords)
      this.debugGraphics.lineStyle(
        isTarget ? 2.2 : 1.4,
        isTarget ? 0xfde047 : 0x38bdf8,
        isTarget ? 0.85 : 0.42
      );
      this.debugGraphics.beginPath();
      this.debugGraphics.arc(
        r.x,
        r.y,
        PHYSICS_CONFIG.maxWireRange,
        Math.PI * 0.5,
        Math.PI * 0.98,
        false
      );
      this.debugGraphics.strokePath();
    }

    if (bestRing && !this.player.isSwinging) {
      this.debugGraphics.lineStyle(2, 0xfde047, 0.85);
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(gx, gy);
      this.debugGraphics.lineTo(bestRing.x, bestRing.y);
      this.debugGraphics.strokePath();
    }

    // 3. Snowflake collection radii
    for (const sf of this.course.snowflakes) {
      if (sf.collected) continue;
      if (
        sf.x < this.cameras.main.scrollX - 80 ||
        sf.x > this.cameras.main.scrollX + GAME_WIDTH + 80
      ) {
        continue;
      }
      const r =
        sf.kind === 'golden'
          ? PHYSICS_CONFIG.collectRadiusGolden
          : PHYSICS_CONFIG.collectRadiusNormal;
      this.debugGraphics.lineStyle(
        1.2,
        sf.kind === 'golden' ? 0xfde047 : 0x7dd3fc,
        0.55
      );
      this.debugGraphics.strokeCircle(sf.x, sf.y, r * 0.5);
    }

    // 4. Platform top surfaces & Arrival Zone highlight
    for (const p of this.course.platforms) {
      if (
        p.x + p.width < this.cameras.main.scrollX - 100 ||
        p.x > this.cameras.main.scrollX + GAME_WIDTH + 100
      ) {
        continue;
      }
      this.debugGraphics.lineStyle(2, p.isArrival ? 0xfacc15 : 0xf43f5e, 0.85);
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(p.x, p.y);
      this.debugGraphics.lineTo(p.x + p.width, p.y);
      this.debugGraphics.strokePath();

      if (p.isArrival) {
        this.debugGraphics.fillStyle(0xfacc15, 0.14);
        this.debugGraphics.fillRect(p.x, p.y - 180, p.width, 180);
      }
    }
  }

  private cleanupWorldObjects(): void {
    for (const obj of this.platformPool.values()) obj.destroy();
    this.platformPool.clear();

    for (const obj of this.ringPool.values()) obj.destroy();
    this.ringPool.clear();

    for (const obj of this.snowflakePool.values()) obj.destroy();
    this.snowflakePool.clear();

    for (const obj of this.guidePool.values()) obj.destroy();
    this.guidePool.clear();

    for (const p of this.endingSnowParticles) p.sprite.destroy();
    this.endingSnowParticles = [];

    for (const p of this.particles) p.active = false;
    for (const g of this.afterimages) {
      g.active = false;
      g.sprite.setVisible(false);
    }
    for (const pop of this.popups) {
      pop.active = false;
      pop.textObj.setVisible(false);
    }

    this.wireGraphics?.clear();
    this.fxGraphics?.clear();
    this.debugGraphics?.clear();
    this.endingWorldGraphics?.clear();
    this.endingSkyGraphics?.clear();
    this.parallaxMidGraphics?.clear();
  }

  private syncBodyDatasetState(mode: GameModeState): void {
    if (typeof document === 'undefined') return;
    const map: Record<GameModeState, string> = {
      READY: 'title',
      INTRO: 'title',
      TUTORIAL: 'playing',
      RUNNING: 'playing',
      ENDING: 'playing',
      PAUSED: 'paused',
      GAMEOVER: 'gameover',
      RESULT: 'gameover',
    };
    document.body.dataset.state = map[mode];
    document.body.dataset.gamemode = mode;
  }

  private buildEndingUiState(): EndingUiState | null {
    if (this.mode !== 'ENDING') return null;
    const t = this.endingElapsed;
    const fadeWindow = Math.max(
      0.1,
      ENDING_CONFIG.arrivalDecelSec - ENDING_CONFIG.arrivalCrossfadeStartSec
    );
    const arrivalFadeAlpha =
      this.endingPhase === 'STORY'
        ? 1
        : Math.max(
            0,
            Math.min(1, (t - ENDING_CONFIG.arrivalCrossfadeStartSec) / fadeWindow)
          );

    return {
      phase: this.endingPhase,
      elapsed: t,
      arrivalFadeAlpha,
      storyStepIndex: this.endingStoryStepIndex,
      isBonusUnlocked: Boolean(this.lockedStats?.earnedSnowflowerBadge),
      collectionPercent: this.lockedStats?.collectionPercent ?? 0,
      collectedUniqueSnowflakes:
        this.lockedStats?.collectedUniqueSnowflakes ?? 0,
      totalCourseSnowflakes: this.lockedStats?.totalCourseSnowflakes ?? 0,
    };
  }

  private computeStageRatios(): [number, number, number] {
    const span = Math.max(1, this.course.arrivalStartX - this.course.startX);
    const r1 = Math.max(
      0.1,
      Math.min(0.8, (this.course.stage1EndX - this.course.startX) / span)
    );
    const r2 = Math.max(
      0.1,
      Math.min(0.8 - r1 + 0.1, (this.course.stage2EndX - this.course.stage1EndX) / span)
    );
    const r3 = Math.max(0.05, 1 - r1 - r2);
    return [r1, r2, r3];
  }

  private emitHudSnapshot(_immediate: boolean): void {
    const scores = calculateScores(
      this.course.startX,
      this.player.x,
      this.normalCount,
      this.goldenCount
    );

    const isCleared =
      this.mode === 'ENDING' ||
      (this.mode === 'RESULT' && !this.player.isDead);
    const progress = isCleared ? 1 : this.maxReachedProgress;
    const displayProgress = isCleared ? 1 : this.smoothedDisplayProgress;

    const isTutorialCourse = this.course.mode === 'tutorial';
    const stageCfg = isTutorialCourse
      ? { id: 1 as StageId, name: '연습 코스' }
      : STAGE_CONFIGS[this.activeStageId - 1];

    this.onHudUpdate({
      mode: this.mode,
      resumeTarget: this.resumeTarget,
      introStepIndex: this.introStepIndex,
      isTutorialCourse,
      score:
        this.lockedStats &&
        (this.mode === 'ENDING' ||
          this.mode === 'RESULT' ||
          this.mode === 'GAMEOVER')
          ? this.lockedStats.totalScore
          : scores.totalScore,
      distanceMeters:
        this.lockedStats &&
        (this.mode === 'ENDING' ||
          this.mode === 'RESULT' ||
          this.mode === 'GAMEOVER')
          ? this.lockedStats.distanceMeters
          : scores.distanceMeters,
      normalCount:
        this.lockedStats &&
        (this.mode === 'ENDING' ||
          this.mode === 'RESULT' ||
          this.mode === 'GAMEOVER')
          ? this.lockedStats.normalCount
          : this.normalCount,
      goldenCount:
        this.lockedStats &&
        (this.mode === 'ENDING' ||
          this.mode === 'RESULT' ||
          this.mode === 'GAMEOVER')
          ? this.lockedStats.goldenCount
          : this.goldenCount,
      highScore: this.highScore,
      stageId: stageCfg.id,
      stageName: stageCfg.name,
      progress,
      displayProgress,
      stageRatios: this.computeStageRatios(),
      stageBanner: this.stageBannerText,
      stageSubBanner: this.stageSubBannerText,
      tutorialHint: this.mode === 'TUTORIAL' ? this.tutorialHintText : null,
      tutorialCompleted: this.tutorialCompleted,
      bgmMuted: this.soundMgr.isBgmMuted(),
      sfxMuted: this.soundMgr.isSfxMuted(),
      ending: this.buildEndingUiState(),
      resultStats: this.lockedStats,
      failureHint: this.mode === 'GAMEOVER' ? this.lastFailureHint : null,
      debugEnabled: this.debugEnabled,
    });
  }
}
