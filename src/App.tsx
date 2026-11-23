import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CourseProgressBar } from './components/CourseProgressBar';
import { EndingStoryOverlay } from './components/EndingStoryOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HudOverlay } from './components/HudOverlay';
import { IntroOverlay } from './components/IntroOverlay';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ModalOverlays } from './components/ModalOverlays';
import { NicknameModal } from './components/NicknameModal';
import { TitleOverlay } from './components/TitleOverlay';
import { ensureAnonymousUser } from './firebase/client';
import {
  getActiveLeaderboardSubscriberCount,
  submitRunScore,
} from './firebase/leaderboardService';
import { GAME_RULE_VERSION } from './game/config';
import { GameController } from './game/GameController';
import {
  derivePublicTagCode,
  isRunEligibleForLeaderboard,
  validateNickname,
} from './game/leaderboardLogic';
import {
  loadBgmMutedSetting,
  loadHighScore,
  loadSavedNickname,
  loadSfxMutedSetting,
  saveNickname,
} from './game/storage';
import {
  HudSnapshot,
  RunStats,
  ScoreSubmissionState,
  StageId,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  mode: 'READY',
  resumeTarget: 'RUNNING',
  introStepIndex: 0,
  isTutorialCourse: false,
  score: 0,
  distanceMeters: 0,
  normalCount: 0,
  goldenCount: 0,
  highScore: loadHighScore(),
  stageId: 1,
  stageName: '순헌관 야간 탈출',
  progress: 0,
  displayProgress: 0,
  stageRatios: [0.3, 0.35, 0.35],
  stageBanner: null,
  stageSubBanner: null,
  tutorialHint: null,
  tutorialCompleted: false,
  bgmMuted: loadBgmMutedSetting(),
  sfxMuted: loadSfxMutedSetting(),
  ending: null,
  resultStats: null,
  failureHint: null,
  debugEnabled: false,
};

const IDLE_SUBMISSION: ScoreSubmissionState = {
  status: 'idle',
  runId: null,
};

function RunawayNinjaSongiApp() {
  const interactionRootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<GameController | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [nickname, setNickname] = useState<string>(() => loadSavedNickname());
  const [publicTagCode, setPublicTagCode] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [needsAnonAuthEnable, setNeedsAnonAuthEnable] = useState(false);

  const [nicknameModalMode, setNicknameModalMode] = useState<
    'start' | 'edit' | 'resume_main' | null
  >(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [submissionState, setSubmissionState] =
    useState<ScoreSubmissionState>(IDLE_SUBMISSION);
  const submittedRunIdsRef = useRef<Set<string>>(new Set());
  const latestRunStatsRef = useRef<RunStats | null>(null);
  const nicknameRef = useRef<string>(nickname);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);

  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { autoStart: false, isDevMode: false };
    }
    const sp = new URLSearchParams(window.location.search);
    return {
      autoStart: sp.get('autostart') === '1',
      isDevMode: sp.get('dev') === '1',
    };
  }, []);

  // Eagerly establish Firebase Anonymous Auth session (no Google/email login prompt)
  useEffect(() => {
    let active = true;
    void ensureAnonymousUser().then((res) => {
      if (!active) return;
      if (res.user) {
        setPublicTagCode(derivePublicTagCode(res.user.uid));
        setAuthReady(true);
        setNeedsAnonAuthEnable(false);
      } else {
        setAuthReady(false);
        setNeedsAnonAuthEnable(res.needsAnonymousAuthEnable);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleRequestStartFromTitle = useCallback(() => {
    setNicknameModalMode('start');
  }, []);

  useEffect(() => {
    const canvasHost = canvasHostRef.current;
    const interactionRoot = interactionRootRef.current;
    if (!canvasHost || !interactionRoot) return;

    const ctrl = new GameController();
    controllerRef.current = ctrl;

    ctrl.mount(
      canvasHost,
      interactionRoot,
      (snapshot) => {
        setHud(snapshot);
      },
      {
        autoStart: urlParams.autoStart,
        isDevMode: urlParams.isDevMode,
        onStartKeyRequest: handleRequestStartFromTitle,
      }
    );

    return () => {
      ctrl.destroy();
      controllerRef.current = null;
    };
  }, [urlParams.autoStart, urlParams.isDevMode, handleRequestStartFromTitle]);

  // Execute a score submission for a locked RunStats record (using its exact unique runId)
  const executeRunSubmission = useCallback(async (stats: RunStats) => {
    const eligibility = isRunEligibleForLeaderboard(stats);
    if (!eligibility.eligible) {
      setSubmissionState({
        status: 'ineligible',
        runId: stats.runId,
        ineligibleReason: eligibility.reason,
      });
      return;
    }

    const activeNick = validateNickname(nicknameRef.current);
    if (!activeNick.valid) {
      setSubmissionState({
        status: 'failed',
        runId: stats.runId,
        message: '유효한 닉네임이 설정되지 않아 랭킹에 등록할 수 없습니다.',
      });
      return;
    }

    setSubmissionState({
      status: 'submitting',
      runId: stats.runId,
    });

    const result = await submitRunScore({
      runId: stats.runId,
      nickname: activeNick.normalized,
      ruleVersion: stats.ruleVersion || GAME_RULE_VERSION,
      score: stats.totalScore,
      normalCount: stats.normalCount,
      goldenCount: stats.goldenCount,
      distanceMeters: stats.distanceMeters,
      cleared: stats.cleared,
    });

    if (result.needsAnonymousAuthEnable) {
      setNeedsAnonAuthEnable(true);
    }

    // Only apply if this run is still the latest active completed run
    if (latestRunStatsRef.current?.runId === stats.runId) {
      setSubmissionState(result);
    }
  }, []);

  // Trigger score submission ONCE per unique runId on GAMEOVER or Clear (ENDING/RESULT)
  useEffect(() => {
    const stats = hud.resultStats;
    const isEndState =
      hud.mode === 'GAMEOVER' || hud.mode === 'ENDING' || hud.mode === 'RESULT';

    if (!isEndState || !stats) {
      if (hud.mode === 'RUNNING' || hud.mode === 'TUTORIAL' || hud.mode === 'READY') {
        latestRunStatsRef.current = null;
        setSubmissionState(IDLE_SUBMISSION);
      }
      return;
    }

    latestRunStatsRef.current = stats;

    // Never re-submit an already-processed runId (guards Ending Replay & Result re-entry)
    if (submittedRunIdsRef.current.has(stats.runId)) {
      return;
    }
    submittedRunIdsRef.current.add(stats.runId);
    void executeRunSubmission(stats);
  }, [hud.mode, hud.resultStats, executeRunSubmission]);

  // Retry failed submission with the EXACT SAME runId
  const handleRetrySubmission = useCallback(() => {
    const stats = latestRunStatsRef.current;
    if (!stats) return;
    void executeRunSubmission(stats);
  }, [executeRunSubmission]);

  // Safe non-PII diagnostic metrics hook for automated browser verification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__SONGI_RANKING_METRICS__ = () => ({
      activeSubscribers: getActiveLeaderboardSubscriberCount(),
      submissionStatus: submissionState.status,
      submissionRunId: submissionState.runId,
      submissionBestScore: submissionState.bestScore ?? null,
      hasNickname: validateNickname(nicknameRef.current).valid,
      publicTagCode,
      authReady,
      needsAnonAuthEnable,
    });
  }, [submissionState, publicTagCode, authReady, needsAnonAuthEnable]);

  const handleConfirmNickname = useCallback(
    (normalizedNickname: string) => {
      saveNickname(normalizedNickname);
      setNickname(normalizedNickname);
      nicknameRef.current = normalizedNickname;

      const mode = nicknameModalMode;
      setNicknameModalMode(null);

      // Refresh tag preview if anonymous auth became available
      void ensureAnonymousUser().then((res) => {
        if (res.user) {
          setPublicTagCode(derivePublicTagCode(res.user.uid));
          setAuthReady(true);
          setNeedsAnonAuthEnable(false);
        }
      });

      if (mode === 'start') {
        // Nickname confirmed -> Existing 3-page Intro -> Main Game
        controllerRef.current?.openIntro();
      } else if (mode === 'resume_main') {
        controllerRef.current?.startMainGame();
      }
    },
    [nicknameModalMode]
  );

  const handleCancelNickname = useCallback(() => {
    setNicknameModalMode(null);
  }, []);

  const handleOpenIntro = useCallback(() => {
    controllerRef.current?.openIntro();
  }, []);

  const handleIntroNext = useCallback(() => {
    controllerRef.current?.introNext();
  }, []);

  const handleIntroPrev = useCallback(() => {
    controllerRef.current?.introPrev();
  }, []);

  const handleIntroSkip = useCallback(() => {
    controllerRef.current?.introSkip();
  }, []);

  // Retrying after GameOver or Result skips BOTH Nickname Modal and Intro!
  const handleStartMain = useCallback(() => {
    if (!validateNickname(nicknameRef.current).valid) {
      setNicknameModalMode('resume_main');
      return;
    }
    controllerRef.current?.startMainGame();
  }, []);

  const handleStartTutorial = useCallback(() => {
    controllerRef.current?.startTutorial();
  }, []);

  const handlePause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    controllerRef.current?.resume();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setShowLeaderboard(false);
    controllerRef.current?.returnToTitle();
  }, []);

  const handleEndingNext = useCallback(() => {
    controllerRef.current?.endingNext();
  }, []);

  const handleReplayEnding = useCallback(() => {
    controllerRef.current?.replayEnding();
  }, []);

  const handleToggleBgmMute = useCallback(() => {
    const bgmMuted = controllerRef.current?.toggleBgmMute();
    if (typeof bgmMuted === 'boolean') {
      setHud((prev) => ({ ...prev, bgmMuted }));
    }
  }, []);

  const handleToggleSfxMute = useCallback(() => {
    const sfxMuted = controllerRef.current?.toggleSfxMute();
    if (typeof sfxMuted === 'boolean') {
      setHud((prev) => ({ ...prev, sfxMuted }));
    }
  }, []);

  const handlePlayClick = useCallback(() => {
    controllerRef.current?.playClickSound();
  }, []);

  const handleDevStartStage = useCallback((stage: StageId) => {
    controllerRef.current?.startMainGame(stage);
  }, []);

  const handleDevPreviewEnding = useCallback((forceBonus: boolean) => {
    controllerRef.current?.previewEndingDev(forceBonus);
  }, []);

  const handleDevToggleDebug = useCallback(() => {
    controllerRef.current?.toggleDebugDev();
  }, []);

  const handleOpenLeaderboard = useCallback(() => {
    controllerRef.current?.playClickSound();
    setShowLeaderboard(true);
  }, []);

  const handleCloseLeaderboard = useCallback(() => {
    controllerRef.current?.playClickSound();
    setShowLeaderboard(false);
  }, []);

  const handleEditNickname = useCallback(() => {
    setNicknameModalMode('edit');
  }, []);

  const showCourseProgressBar =
    hud.mode === 'RUNNING' ||
    hud.mode === 'TUTORIAL' ||
    hud.mode === 'PAUSED' ||
    hud.mode === 'GAMEOVER';

  return (
    <main
      ref={interactionRootRef}
      data-testid="game-shell"
      className="w-screen h-screen bg-[#060d24] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Aspect-locked 16:9 stage wrapper keeping logical 1280x720 game and gameplay HUD aligned */}
      <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] bg-[#07112c] shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Isolated Phaser Canvas Mount (never re-rendered by React HUD updates) */}
        <div
          ref={canvasHostRef}
          data-testid="phaser-canvas-host"
          className="absolute inset-0 w-full h-full"
        />

        {hud.mode === 'READY' && (
          <TitleOverlay
            highScore={hud.highScore}
            nickname={nickname}
            publicTagCode={publicTagCode}
            bgmMuted={hud.bgmMuted}
            sfxMuted={hud.sfxMuted}
            onRequestStart={handleRequestStartFromTitle}
            onOpenIntro={handleOpenIntro}
            onStartTutorial={handleStartTutorial}
            onOpenLeaderboard={handleOpenLeaderboard}
            onEditNickname={handleEditNickname}
            onToggleBgmMute={handleToggleBgmMute}
            onToggleSfxMute={handleToggleSfxMute}
            onPlayClick={handlePlayClick}
          />
        )}

        <HudOverlay
          hud={hud}
          isDevMode={urlParams.isDevMode}
          onPause={handlePause}
          onToggleBgmMute={handleToggleBgmMute}
          onToggleSfxMute={handleToggleSfxMute}
          onReturnTitle={handleReturnTitle}
          onDevStartStage={handleDevStartStage}
          onDevPreviewEnding={handleDevPreviewEnding}
          onDevToggleDebug={handleDevToggleDebug}
        />

        {/* Fixed Bottom Full-Course Progress Bar (stays above PAUSED/GAMEOVER dimmer on desktop!) */}
        {showCourseProgressBar && (
          <div className="absolute inset-x-0 bottom-3 sm:bottom-4 z-[35] pointer-events-none">
            <CourseProgressBar hud={hud} />
          </div>
        )}
      </div>

      {/* Full-viewport responsive Story & Status Overlays */}
      {hud.mode === 'INTRO' && (
        <IntroOverlay
          stepIndex={hud.introStepIndex}
          bgmMuted={hud.bgmMuted}
          sfxMuted={hud.sfxMuted}
          onNext={handleIntroNext}
          onPrev={handleIntroPrev}
          onSkip={handleIntroSkip}
          onToggleBgmMute={handleToggleBgmMute}
          onToggleSfxMute={handleToggleSfxMute}
        />
      )}

      {hud.mode === 'ENDING' && hud.ending && (
        <EndingStoryOverlay
          ending={hud.ending}
          normalCount={hud.normalCount}
          goldenCount={hud.goldenCount}
          bgmMuted={hud.bgmMuted}
          sfxMuted={hud.sfxMuted}
          onNextStep={handleEndingNext}
          onToggleBgmMute={handleToggleBgmMute}
          onToggleSfxMute={handleToggleSfxMute}
        />
      )}

      <ModalOverlays
        hud={hud}
        submissionState={submissionState}
        onResume={handleResume}
        onRestartMain={handleStartMain}
        onRestartTutorial={handleStartTutorial}
        onReplayEnding={handleReplayEnding}
        onReturnTitle={handleReturnTitle}
        onRetrySubmission={handleRetrySubmission}
        onOpenLeaderboard={handleOpenLeaderboard}
      />

      {nicknameModalMode && (
        <NicknameModal
          initialNickname={nickname}
          publicTagCode={publicTagCode}
          confirmLabel={
            nicknameModalMode === 'edit'
              ? '닉네임 저장'
              : nicknameModalMode === 'resume_main'
                ? '확정하고 바로 탈주'
                : '확정하고 이야기 시작'
          }
          onConfirm={handleConfirmNickname}
          onCancel={handleCancelNickname}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal onClose={handleCloseLeaderboard} />
      )}
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RunawayNinjaSongiApp />
    </ErrorBoundary>
  );
}
