import React from 'react';
import { HudSnapshot, StageId } from '../game/types';
import {
  BgmNoteIconSvg,
  GoldenSnowflakeSvg,
  NormalSnowflakeSvg,
  PauseIconSvg,
  SoundIconSvg,
} from './GameIcons';

interface HudOverlayProps {
  hud: HudSnapshot;
  isDevMode: boolean;
  onPause: () => void;
  onToggleBgmMute: () => void;
  onToggleSfxMute: () => void;
  onReturnTitle: () => void;
  onDevStartStage: (stage: StageId) => void;
  onDevPreviewEnding: (forceBonus: boolean) => void;
  onDevToggleDebug: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  isDevMode,
  onPause,
  onToggleBgmMute,
  onToggleSfxMute,
  onReturnTitle,
  onDevStartStage,
  onDevPreviewEnding,
  onDevToggleDebug,
}) => {
  const isPlaying = hud.mode === 'RUNNING' || hud.mode === 'TUTORIAL';

  // Hide gameplay HUD during INTRO, ENDING, and RESULT (unless dev toolbar is requested outside story overlays)
  if (!isPlaying && (!isDevMode || hud.mode === 'INTRO' || hud.mode === 'ENDING')) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-5 z-20">
      {/* TOP BAR: Enlarged High-Contrast Score & Snowflakes (Left) | Audio (BGM/SFX) & Pause (Right) */}
      <div className="flex items-start justify-between gap-4">
        {isPlaying ? (
          <div
            className="flex items-center gap-4 sm:gap-5 px-4 sm:px-5 py-2.5 rounded-2xl shadow-[0_6px_20px_rgba(3,9,26,0.65)]"
            style={{
              backgroundColor: 'rgba(6, 18, 52, 0.9)',
              border: '1.5px solid rgba(125, 211, 252, 0.45)',
            }}
          >
            <div>
              <div className="text-xs font-extrabold text-sky-300 tracking-wide leading-none">
                점수
              </div>
              <div
                data-testid="hud-score"
                className="mt-0.5 text-3xl sm:text-[32px] font-black text-white tabular-nums leading-none tracking-tight"
              >
                {hud.score.toLocaleString()}
              </div>
            </div>

            <div className="h-9 w-px bg-sky-300/30" />

            <div className="flex items-center gap-4 tabular-nums">
              <div
                className="flex items-center gap-1.5 text-white"
                title="일반 눈꽃 (+10점)"
              >
                <NormalSnowflakeSvg className="w-6 h-6 sm:w-7 sm:h-7" />
                <span
                  data-testid="hud-normal-snowflakes"
                  className="text-xl sm:text-2xl font-extrabold leading-none"
                >
                  {hud.normalCount}
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 text-amber-300"
                title="황금 눈꽃 (+50점)"
              >
                <GoldenSnowflakeSvg className="w-6 h-6 sm:w-7 sm:h-7" />
                <span
                  data-testid="hud-golden-snowflakes"
                  className="text-xl sm:text-2xl font-extrabold leading-none"
                >
                  {hud.goldenCount}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Top-Right Controls: Separate BGM & SFX Toggles + Pause */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {hud.mode === 'TUTORIAL' && (
            <button
              type="button"
              data-ui-interactive="true"
              tabIndex={-1}
              onClick={onReturnTitle}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold text-sky-100 hover:text-white cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(7, 20, 56, 0.9)',
                border: '1.5px solid rgba(125, 211, 252, 0.45)',
              }}
            >
              메뉴로
            </button>
          )}

          {isPlaying && (
            <>
              <button
                type="button"
                data-ui-interactive="true"
                tabIndex={-1}
                onClick={onToggleBgmMute}
                aria-label={hud.bgmMuted ? '배경음악 켜기' : '배경음악 끄기'}
                title={hud.bgmMuted ? '배경음악 켜기' : '배경음악 끄기'}
                className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                style={{
                  backgroundColor: 'rgba(7, 20, 56, 0.9)',
                  border: '1.5px solid rgba(125, 211, 252, 0.45)',
                }}
              >
                <BgmNoteIconSvg muted={hud.bgmMuted} className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                  배경음
                </span>
              </button>

              <button
                type="button"
                data-ui-interactive="true"
                tabIndex={-1}
                onClick={onToggleSfxMute}
                aria-label={hud.sfxMuted ? '효과음 켜기' : '효과음 끄기'}
                title={hud.sfxMuted ? '효과음 켜기' : '효과음 끄기'}
                className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                style={{
                  backgroundColor: 'rgba(7, 20, 56, 0.9)',
                  border: '1.5px solid rgba(125, 211, 252, 0.45)',
                }}
              >
                <SoundIconSvg muted={hud.sfxMuted} className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                  효과음
                </span>
              </button>

              <button
                type="button"
                data-ui-interactive="true"
                tabIndex={-1}
                onClick={onPause}
                aria-label="일시정지"
                title="일시정지 (Esc)"
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                style={{
                  backgroundColor: 'rgba(7, 20, 56, 0.9)',
                  border: '1.5px solid rgba(125, 211, 252, 0.45)',
                }}
              >
                <PauseIconSvg className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* CENTER-TOP NOTIFICATIONS: Stage Transition Banner + Meokbabi Story Callout OR Tutorial Guide */}
      <div className="flex-1 flex flex-col items-center justify-start pt-2 pointer-events-none">
        {isPlaying && hud.stageBanner && (
          <div
            data-testid="hud-stage-banner"
            className="px-6 py-2.5 rounded-xl text-center shadow-lg transition-opacity duration-200"
            style={{
              backgroundColor: 'rgba(0, 48, 135, 0.92)',
              border: '1.5px solid rgba(253, 224, 71, 0.78)',
            }}
          >
            <div className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              {hud.stageBanner}
            </div>
            {hud.stageSubBanner && (
              <div
                data-testid="hud-stage-subbanner"
                className="mt-0.5 text-sm sm:text-base font-extrabold text-amber-300 tracking-tight"
              >
                {hud.stageSubBanner}
              </div>
            )}
          </div>
        )}

        {hud.mode === 'TUTORIAL' && hud.tutorialHint && !hud.stageBanner && (
          <div
            className="px-5 py-2.5 rounded-xl text-center max-w-xl shadow-md"
            style={{
              backgroundColor: 'rgba(7, 20, 56, 0.92)',
              border: '1.5px solid rgba(125, 211, 252, 0.68)',
            }}
          >
            <p className="text-sm sm:text-base font-bold text-white">
              {hud.tutorialHint}
            </p>
          </div>
        )}
      </div>

      {/* LOWER UTILITY ROW (strictly ?dev=1 only, hidden on normal URLs) */}
      <div className="pb-14 sm:pb-16 flex items-end justify-between gap-3">
        {isDevMode ? (
          <div
            data-ui-interactive="true"
            className="pointer-events-auto flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(250, 204, 21, 0.5)',
            }}
          >
            <span className="text-amber-300 font-bold mr-1">DEV</span>
            <button
              type="button"
              onClick={() => onDevStartStage(1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 cursor-pointer whitespace-nowrap"
            >
              1구간 시작
            </button>
            <button
              type="button"
              onClick={() => onDevStartStage(2)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 cursor-pointer whitespace-nowrap"
            >
              2구간 시작
            </button>
            <button
              type="button"
              onClick={() => onDevStartStage(3)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-200 cursor-pointer whitespace-nowrap"
            >
              3구간 시작
            </button>
            <button
              type="button"
              onClick={() => onDevPreviewEnding(false)}
              className="px-2 py-1 rounded bg-amber-900/80 hover:bg-amber-800 text-amber-200 cursor-pointer whitespace-nowrap"
            >
              엔딩 확인(0%)
            </button>
            <button
              type="button"
              onClick={() => onDevPreviewEnding(true)}
              className="px-2 py-1 rounded bg-amber-700/90 hover:bg-amber-600 text-white cursor-pointer whitespace-nowrap"
            >
              보너스 엔딩(85%)
            </button>
            <button
              type="button"
              onClick={onDevToggleDebug}
              className={`px-2 py-1 rounded cursor-pointer whitespace-nowrap ${
                hud.debugEnabled
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              고리·충돌 범위 표시 {hud.debugEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
};
