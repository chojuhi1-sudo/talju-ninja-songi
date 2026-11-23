import React from 'react';
import { HudSnapshot } from '../game/types';
import { GoldenSnowflakeSvg, MiniChubbySongiHeadSvg } from './GameIcons';

interface CourseProgressBarProps {
  hud: HudSnapshot;
}

/**
 * Gogunbuntu-inspired fixed bottom full-course progress bar (88~92% viewport width).
 * - Driven strictly by Songi's world X progress (startX -> arrivalStartX)
 * - Divided proportionally into 3 campus stages: 순헌관 (Blue) / 명신관 (Cyan-Teal) / 눈꽃광장 (Gold-Violet)
 * - Displays a moving mini Chubby Ninja Songi face marker + glow dot
 * - Stays clearly visible on GAMEOVER so the player can inspect their exact fail position
 */
export const CourseProgressBar: React.FC<CourseProgressBarProps> = ({ hud }) => {
  const isFailed = hud.mode === 'GAMEOVER';
  const clampedProg = Math.max(0, Math.min(1, hud.displayProgress));
  const exactPercent = Math.round(Math.max(0, Math.min(1, hud.progress)) * 100);

  const [r1, r2, r3] = hud.stageRatios;
  const b1Pct = r1 * 100;
  const b2Pct = (r1 + r2) * 100;
  const markerPct = clampedProg * 100;

  // Compute local fill [0..1] inside each of the 3 stage segments so each stage lights up in its own color!
  const seg1Fill = Math.max(0, Math.min(1, clampedProg / Math.max(0.001, r1)));
  const seg2Fill = Math.max(
    0,
    Math.min(1, (clampedProg - r1) / Math.max(0.001, r2))
  );
  const seg3Fill = Math.max(
    0,
    Math.min(1, (clampedProg - r1 - r2) / Math.max(0.001, r3))
  );

  return (
    <div
      data-testid="course-progress-bar"
      data-progress-pct={exactPercent}
      className="w-[90%] max-w-[1152px] mx-auto pointer-events-none select-none"
    >
      <div
        className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl shadow-[0_8px_24px_rgba(3,9,26,0.75)]"
        style={{
          backgroundColor: isFailed
            ? 'rgba(10, 22, 58, 0.94)'
            : 'rgba(6, 17, 48, 0.88)',
          border: isFailed
            ? '1.5px solid rgba(251, 191, 36, 0.68)'
            : '1.5px solid rgba(125, 211, 252, 0.45)',
        }}
      >
        <div className="flex items-center gap-3.5">
          {/* LEFT: START Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-300 shadow-[0_0_8px_#7dd3fc]" />
            <span className="text-xs sm:text-sm font-extrabold text-sky-100 tracking-tight">
              출발
            </span>
          </div>

          {/* CENTER: 3-Stage Segmented Track + Labels + Moving Songi Face Marker */}
          <div className="relative flex-1 pt-4 pb-1">
            {/* Stage Segment Labels Row */}
            {hud.isTutorialCourse ? (
              <div className="absolute top-0 inset-x-0 flex items-center justify-between text-[11px] sm:text-xs font-extrabold text-sky-200 px-1">
                <span>연습 코스 · 기본 점프 &amp; 와이어 훈련</span>
                <span className="text-amber-300 tabular-nums">{exactPercent}%</span>
              </div>
            ) : (
              <div className="absolute -top-0.5 inset-x-0 flex items-center text-[11px] sm:text-xs font-extrabold leading-none">
                <div
                  style={{ width: `${b1Pct}%` }}
                  className={`text-center truncate transition-colors ${
                    hud.stageId === 1
                      ? 'text-sky-200'
                      : clampedProg >= r1
                        ? 'text-sky-300/80'
                        : 'text-slate-300/75'
                  }`}
                >
                  순헌관
                </div>
                <div
                  style={{ width: `${r2 * 100}%` }}
                  className={`text-center truncate transition-colors ${
                    hud.stageId === 2
                      ? 'text-cyan-200'
                      : clampedProg >= r1 + r2
                        ? 'text-cyan-300/80'
                        : 'text-slate-300/75'
                  }`}
                >
                  명신관
                </div>
                <div
                  style={{ width: `${r3 * 100}%` }}
                  className={`text-center truncate transition-colors ${
                    hud.stageId === 3
                      ? 'text-amber-200'
                      : 'text-slate-300/75'
                  }`}
                >
                  눈꽃광장
                </div>
              </div>
            )}

            {/* Slim Segmented Track */}
            <div className="relative h-3 rounded-full overflow-hidden flex bg-[#040b1e] border border-sky-300/30">
              {/* Stage 1: 순헌관 (Sookmyung Royal Blue) */}
              <div
                style={{ width: `${b1Pct}%` }}
                className="relative h-full bg-[#0d2154] overflow-hidden"
              >
                <div
                  className="h-full w-full origin-left bg-[#3b82f6]"
                  style={{ transform: `scaleX(${seg1Fill})` }}
                />
              </div>

              {/* Stage 2: 명신관 (Hillside Cyan-Teal) */}
              <div
                style={{ width: `${r2 * 100}%` }}
                className="relative h-full bg-[#09273c] overflow-hidden"
              >
                <div
                  className="h-full w-full origin-left bg-[#06b6d4]"
                  style={{ transform: `scaleX(${seg2Fill})` }}
                />
              </div>

              {/* Stage 3: 눈꽃광장 (Plaza Gold-Violet) */}
              <div
                style={{ width: `${r3 * 100}%` }}
                className="relative h-full bg-[#1e1642] overflow-hidden"
              >
                <div
                  className="h-full w-full origin-left bg-[#fbbf24]"
                  style={{ transform: `scaleX(${seg3Fill})` }}
                />
              </div>

              {/* Stage Boundary Divider Ticks */}
              {!hud.isTutorialCourse && (
                <>
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white/80 z-10"
                    style={{ left: `${b1Pct}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white/80 z-10"
                    style={{ left: `${b2Pct}%` }}
                  />
                </>
              )}
            </div>

            {/* Moving Mini Chubby Songi Marker + Luminous Position Glow */}
            <div
              data-testid="course-progress-marker"
              className="absolute top-2.5 z-20 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${markerPct}%` }}
            >
              <div className="relative flex items-center justify-center">
                {/* Glow ring behind Songi marker */}
                <span
                  className="absolute w-7 h-7 rounded-full"
                  style={{
                    backgroundColor: isFailed
                      ? 'rgba(251, 146, 60, 0.38)'
                      : 'rgba(125, 211, 252, 0.36)',
                    boxShadow: isFailed
                      ? '0 0 12px rgba(251, 191, 36, 0.85)'
                      : '0 0 12px rgba(56, 189, 248, 0.9)',
                  }}
                />
                <MiniChubbySongiHeadSvg
                  failed={isFailed}
                  className="relative w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_2px_6px_rgba(3,8,24,0.9)]"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Snowflower GOAL Crest + Percentage */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0a1f56] border border-amber-300/50">
              <GoldenSnowflakeSvg className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="text-xs font-black text-amber-300 tracking-wide">
                GOAL
              </span>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-white tabular-nums min-w-[3ch] text-right">
              {exactPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
