import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { SNOWFLOWER_BADGE_NAME } from '../game/story';
import { HudSnapshot, ScoreSubmissionState } from '../game/types';
import {
  GoldenSnowflakeSvg,
  NormalSnowflakeSvg,
  SnowflowerDeliveryBadgeSvg,
} from './GameIcons';

interface ModalOverlaysProps {
  hud: HudSnapshot;
  submissionState: ScoreSubmissionState;
  onResume: () => void;
  onRestartMain: () => void;
  onRestartTutorial: () => void;
  onReplayEnding: () => void;
  onReturnTitle: () => void;
  onRetrySubmission: () => void;
  onOpenLeaderboard: () => void;
}

const SubmissionStatusBanner: React.FC<{
  submissionState: ScoreSubmissionState;
  onRetrySubmission: () => void;
}> = ({ submissionState, onRetrySubmission }) => {
  if (submissionState.status === 'idle') return null;

  if (submissionState.status === 'ineligible') {
    const label =
      submissionState.ineligibleReason === 'dev'
        ? '개발 모드 기록은 온라인 순위표에 등록되지 않습니다.'
        : '연습 모드 기록은 온라인 순위표에 등록되지 않습니다.';
    return (
      <div
        data-testid="submission-status-banner"
        data-status="ineligible"
        className="mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-sky-200/85 text-center"
        style={{
          backgroundColor: 'rgba(5, 13, 36, 0.72)',
          border: '1px solid rgba(125, 211, 252, 0.22)',
        }}
      >
        {label}
      </div>
    );
  }

  if (submissionState.status === 'submitting') {
    return (
      <div
        data-testid="submission-status-banner"
        data-status="submitting"
        className="mt-3 px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-sky-200"
        style={{
          backgroundColor: 'rgba(10, 34, 88, 0.85)',
          border: '1px solid rgba(125, 211, 252, 0.4)',
        }}
      >
        <Loader2 className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
        <span>기록 등록 중...</span>
      </div>
    );
  }

  if (submissionState.status === 'registered') {
    return (
      <div
        data-testid="submission-status-banner"
        data-status="registered"
        className="mt-3 px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-200"
        style={{
          backgroundColor: 'rgba(6, 78, 59, 0.45)',
          border: '1px solid rgba(52, 211, 153, 0.55)',
        }}
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
        <span>기록 등록 완료</span>
      </div>
    );
  }

  if (submissionState.status === 'kept_best') {
    return (
      <div
        data-testid="submission-status-banner"
        data-status="kept_best"
        className="mt-3 px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-sky-100"
        style={{
          backgroundColor: 'rgba(10, 36, 99, 0.75)',
          border: '1px solid rgba(125, 211, 252, 0.45)',
        }}
      >
        <ShieldCheck className="w-4 h-4 text-sky-300 shrink-0" />
        <span>
          개인 최고기록 유지
          {typeof submissionState.bestScore === 'number'
            ? ` (${submissionState.bestScore.toLocaleString()}점)`
            : ''}
        </span>
      </div>
    );
  }

  // status === 'failed'
  return (
    <div
      data-testid="submission-status-banner"
      data-status="failed"
      className="mt-3 px-3.5 py-2.5 rounded-xl flex flex-col gap-2 text-left"
      style={{
        backgroundColor: 'rgba(127, 29, 29, 0.35)',
        border: '1px solid rgba(248, 113, 113, 0.55)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>등록 실패 — 다시 시도</span>
        </span>
        <button
          type="button"
          data-testid="submission-retry-btn"
          data-ui-interactive="true"
          onClick={onRetrySubmission}
          className="px-2.5 py-1 rounded-lg text-xs font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>다시 시도</span>
        </button>
      </div>
      {submissionState.message && (
        <p className="text-[11px] sm:text-xs text-rose-100/90 leading-relaxed break-keep">
          {submissionState.message}
        </p>
      )}
    </div>
  );
};

export const ModalOverlays: React.FC<ModalOverlaysProps> = ({
  hud,
  submissionState,
  onResume,
  onRestartMain,
  onRestartTutorial,
  onReplayEnding,
  onReturnTitle,
  onRetrySubmission,
  onOpenLeaderboard,
}) => {
  if (
    hud.mode !== 'PAUSED' &&
    hud.mode !== 'GAMEOVER' &&
    hud.mode !== 'RESULT'
  ) {
    return null;
  }

  const stats = hud.resultStats;

  // 1. PAUSED MODAL (lifted above bottom CourseProgressBar so current progress stays visible)
  if (hud.mode === 'PAUSED') {
    const isTutorialPause = hud.resumeTarget === 'TUTORIAL';
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
        data-ui-interactive="true"
        className="fixed inset-0 z-30 flex items-center justify-center p-4 md:pb-20 overflow-y-auto"
        style={{ backgroundColor: 'rgba(4, 10, 28, 0.76)' }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 sm:p-7 text-center shadow-2xl"
          style={{
            backgroundColor: '#08173d',
            border: '1.5px solid rgba(125, 211, 252, 0.5)',
          }}
        >
          <h2
            id="pause-modal-title"
            className="text-2xl font-extrabold text-white"
          >
            일시정지
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-sky-200">
            잠시 숨을 고르는 중입니다.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              data-ui-interactive="true"
              onClick={onResume}
              className="w-full py-3 rounded-xl text-base font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
            >
              계속하기
            </button>
            <button
              type="button"
              data-ui-interactive="true"
              onClick={isTutorialPause ? onRestartTutorial : onRestartMain}
              className="w-full py-3 rounded-xl text-base font-bold text-white bg-[#003087] hover:bg-[#0a3fa3] border border-sky-300/50 cursor-pointer whitespace-nowrap"
            >
              다시 시작
            </button>
            <button
              type="button"
              data-ui-interactive="true"
              onClick={onReturnTitle}
              className="w-full py-3 rounded-xl text-base font-semibold text-sky-100 hover:text-white border border-sky-300/35 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'rgba(6, 15, 42, 0.9)' }}
            >
              처음으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. GAMEOVER MODAL (lifted on md+ so the bottom CourseProgressBar & fail marker remain unobstructed)
  if (hud.mode === 'GAMEOVER') {
    const score = stats?.totalScore ?? hud.score;
    const dist = stats?.distanceMeters ?? hud.distanceMeters;
    const normal = stats?.normalCount ?? hud.normalCount;
    const golden = stats?.goldenCount ?? hud.goldenCount;
    const best = stats?.highScore ?? hud.highScore;
    const reachedPct = Math.round(Math.max(0, Math.min(1, hud.progress)) * 100);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameover-modal-title"
        data-ui-interactive="true"
        className="fixed inset-0 z-30 flex items-center justify-center p-4 md:pb-20 overflow-y-auto"
        style={{ backgroundColor: 'rgba(4, 10, 28, 0.78)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-5 sm:p-6 text-center shadow-2xl"
          style={{
            backgroundColor: '#08173d',
            border: '1.5px solid rgba(125, 211, 252, 0.52)',
          }}
        >
          <h2
            id="gameover-modal-title"
            className="text-2xl sm:text-3xl font-extrabold text-amber-300"
          >
            탈주 실패!
          </h2>
          <p className="mt-1 text-base font-semibold text-sky-100">
            과제가 송이를 붙잡았다…
          </p>

          <div
            className="mt-4 rounded-xl p-4 space-y-2 text-sm tabular-nums"
            style={{
              backgroundColor: 'rgba(5, 13, 36, 0.84)',
              border: '1px solid rgba(125, 211, 252, 0.28)',
            }}
          >
            <div className="flex items-center justify-between text-base">
              <span className="text-sky-200 font-bold">점수</span>
              <span className="text-2xl font-extrabold text-white">
                {score.toLocaleString()}점
              </span>
            </div>
            <div className="h-px bg-sky-300/15" />
            <div className="flex items-center justify-between">
              <span className="text-sky-100/90 font-medium">
                도달 구간 · 진행도
              </span>
              <span className="font-extrabold text-amber-300">
                {hud.stageId}구간 ({reachedPct}%) · {dist.toLocaleString()}m
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sky-100/90 font-medium">수집한 눈꽃</span>
              <span className="flex items-center gap-3 font-bold">
                <span className="flex items-center gap-1 text-white">
                  <NormalSnowflakeSvg className="w-4 h-4" />
                  {normal}개
                </span>
                <span className="text-sky-500">·</span>
                <span className="flex items-center gap-1 text-amber-300">
                  <GoldenSnowflakeSvg className="w-4 h-4" />
                  {golden}개
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-sky-300/15">
              <span className="text-sky-100/90 font-medium">최고기록</span>
              <span className="font-extrabold text-amber-300">
                {best.toLocaleString()}점
              </span>
            </div>
          </div>

          <SubmissionStatusBanner
            submissionState={submissionState}
            onRetrySubmission={onRetrySubmission}
          />

          {hud.failureHint && (
            <div
              data-testid="gameover-failure-hint"
              className="mt-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-sky-100 break-keep leading-relaxed"
              style={{
                backgroundColor: 'rgba(0, 48, 135, 0.55)',
                border: '1px solid rgba(125, 211, 252, 0.42)',
              }}
            >
              <span className="text-amber-300 font-extrabold mr-1.5">TIP</span>
              {hud.failureHint}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              data-ui-interactive="true"
              onClick={onRestartMain}
              className="w-full py-3.5 rounded-xl text-base font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
            >
              다시 탈주하기
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                data-testid="gameover-leaderboard-btn"
                data-ui-interactive="true"
                onClick={onOpenLeaderboard}
                className="flex-1 py-3 rounded-xl text-sm font-extrabold text-amber-200 hover:text-white bg-[#003087] hover:bg-[#0a3fa3] border border-amber-300/50 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Trophy className="w-4 h-4 text-amber-300" />
                <span>실시간 순위표</span>
              </button>
              <button
                type="button"
                data-ui-interactive="true"
                onClick={onReturnTitle}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-sky-100 hover:text-white border border-sky-300/40 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: 'rgba(6, 15, 42, 0.9)' }}
              >
                처음으로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. RESULT MODAL (Main Course Clear OR Practice Complete)
  const isTutorialResult = Boolean(stats?.isTutorial || hud.tutorialCompleted);
  const finalScore = stats?.totalScore ?? hud.score;
  const normalCount = stats?.normalCount ?? hud.normalCount;
  const goldenCount = stats?.goldenCount ?? hud.goldenCount;
  const collectionPercent = stats?.collectionPercent ?? 0;
  const collectedUnique =
    stats?.collectedUniqueSnowflakes ?? normalCount + goldenCount;
  const totalUnique = stats?.totalCourseSnowflakes ?? 0;
  const earnedBadge = Boolean(stats?.earnedSnowflowerBadge);
  const bestScore = stats?.highScore ?? hud.highScore;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-modal-title"
      data-ui-interactive="true"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(4, 10, 28, 0.82)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 sm:p-6 text-center shadow-2xl my-auto"
        style={{
          backgroundColor: '#08173d',
          border: '1.5px solid rgba(253, 224, 71, 0.55)',
        }}
      >
        <h2
          id="result-modal-title"
          className="text-2xl sm:text-3xl font-extrabold text-amber-300"
        >
          {isTutorialResult ? '연습 완료!' : '오늘의 임무 완료!'}
        </h2>
        <p className="mt-1 text-sm sm:text-base font-semibold text-sky-100 break-keep">
          {isTutorialResult
            ? '점프와 와이어 감각을 익혔어요. 이제 진짜 탈주를 시작해 볼까요?'
            : '먹밥이와 고양이들이 준비한 눈꽃광장 쉼터에서 포근한 밤을 보냈습니다.'}
        </p>

        <div
          className="mt-4 rounded-xl p-4 space-y-2.5 text-sm tabular-nums"
          style={{
            backgroundColor: 'rgba(5, 13, 36, 0.86)',
            border: '1px solid rgba(125, 211, 252, 0.28)',
          }}
        >
          <div className="flex items-center justify-between text-base">
            <span className="text-sky-200 font-bold">
              {isTutorialResult ? '연습 점수 (기록 미반영)' : '점수'}
            </span>
            <span className="text-2xl font-extrabold text-white">
              {finalScore.toLocaleString()}점
            </span>
          </div>

          <div className="h-px bg-sky-300/15" />

          <div className="flex items-center justify-between">
            <span className="text-sky-100/90 font-medium">일반 눈꽃</span>
            <span className="flex items-center gap-1.5 font-bold text-white">
              <NormalSnowflakeSvg className="w-4 h-4" />
              {normalCount}개
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sky-100/90 font-medium">황금 눈꽃</span>
            <span className="flex items-center gap-1.5 font-bold text-amber-300">
              <GoldenSnowflakeSvg className="w-4 h-4" />
              {goldenCount}개
            </span>
          </div>

          {!isTutorialResult && (
            <div className="flex items-center justify-between">
              <span className="text-sky-100/90 font-medium">
                전체 눈꽃 수집률
              </span>
              <span
                data-testid="result-collection-rate"
                className={`font-extrabold ${
                  earnedBadge ? 'text-amber-300' : 'text-sky-100'
                }`}
              >
                {collectionPercent}% ({collectedUnique}/{totalUnique}개)
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-sky-300/15">
            <span className="text-sky-100/90 font-medium">최고기록</span>
            <span className="font-extrabold text-amber-300">
              {bestScore.toLocaleString()}점
              {stats?.isNewRecord ? ' (신기록!)' : ''}
            </span>
          </div>
        </div>

        <SubmissionStatusBanner
          submissionState={submissionState}
          onRetrySubmission={onRetrySubmission}
        />

        {/* Earned Commemorative Badge Section (Main Course Clear) */}
        {!isTutorialResult && (
          <div
            data-testid="result-badge-panel"
            className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-left"
            style={{
              backgroundColor: earnedBadge
                ? 'rgba(10, 36, 99, 0.92)'
                : 'rgba(5, 13, 36, 0.72)',
              border: earnedBadge
                ? '1.5px solid rgba(253, 224, 71, 0.65)'
                : '1px solid rgba(125, 211, 252, 0.22)',
            }}
          >
            <div className="flex items-center gap-3">
              <SnowflowerDeliveryBadgeSvg
                className={`w-9 h-9 shrink-0 ${
                  earnedBadge ? '' : 'opacity-40 grayscale'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-sky-300">획득한 배지</div>
                {earnedBadge ? (
                  <div
                    data-testid="result-earned-badge"
                    className="text-base font-extrabold text-amber-300"
                  >
                    {SNOWFLOWER_BADGE_NAME}
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm font-semibold text-slate-300 break-keep">
                    눈꽃 80% 이상 수집 시 「{SNOWFLOWER_BADGE_NAME}」 획득
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isTutorialResult ? (
          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              data-start="true"
              data-ui-interactive="true"
              onClick={onRestartMain}
              className="flex-1 py-3 rounded-xl text-base font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
            >
              탈주 시작하기
            </button>
            <button
              type="button"
              data-ui-interactive="true"
              onClick={onRestartTutorial}
              className="px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#003087] hover:bg-[#0a3fa3] border border-sky-300/50 cursor-pointer whitespace-nowrap"
            >
              다시 연습
            </button>
            <button
              type="button"
              data-ui-interactive="true"
              onClick={onReturnTitle}
              className="px-4 py-3 rounded-xl text-sm font-semibold text-sky-100 hover:text-white border border-sky-300/35 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: 'rgba(6, 15, 42, 0.9)' }}
            >
              처음으로
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              data-ui-interactive="true"
              onClick={onRestartMain}
              className="w-full py-3.5 rounded-xl text-base font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
            >
              다시 탈주하기
            </button>
            <button
              type="button"
              data-testid="result-leaderboard-btn"
              data-ui-interactive="true"
              onClick={onOpenLeaderboard}
              className="w-full py-3 rounded-xl text-sm font-extrabold text-amber-200 hover:text-white bg-[#003087] hover:bg-[#0a3fa3] border border-amber-300/55 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>실시간 온라인 순위표 보기</span>
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                data-testid="result-replay-ending-btn"
                data-ui-interactive="true"
                onClick={onReplayEnding}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#003087]/80 hover:bg-[#0a3fa3] border border-sky-300/45 cursor-pointer whitespace-nowrap"
              >
                엔딩 다시 보기
              </button>
              <button
                type="button"
                data-ui-interactive="true"
                onClick={onReturnTitle}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-sky-100 hover:text-white border border-sky-300/35 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: 'rgba(6, 15, 42, 0.9)' }}
              >
                처음으로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
