import React, { useEffect, useState } from 'react';
import { ENDING_STORY_STEPS } from '../game/story';
import { EndingUiState } from '../game/types';
import {
  BgmNoteIconSvg,
  CatPawStampSvg,
  GoldenSnowflakeSvg,
  NormalSnowflakeSvg,
  SoundIconSvg,
} from './GameIcons';

interface EndingStoryOverlayProps {
  ending: EndingUiState;
  normalCount: number;
  goldenCount: number;
  bgmMuted: boolean;
  sfxMuted: boolean;
  onNextStep: () => void;
  onToggleBgmMute: () => void;
  onToggleSfxMute: () => void;
}

const SKY_TWINKLE_SPOTS: ReadonlyArray<{
  left: string;
  top: string;
  delay: string;
}> = [
  { left: '34%', top: '10%', delay: '0s' },
  { left: '48%', top: '7%', delay: '0.7s' },
  { left: '61%', top: '9%', delay: '1.3s' },
  { left: '74%', top: '12%', delay: '0.4s' },
  { left: '84%', top: '8%', delay: '1.8s' },
];

export const EndingStoryOverlay: React.FC<EndingStoryOverlayProps> = ({
  ending,
  normalCount,
  goldenCount,
  bgmMuted,
  sfxMuted,
  onNextStep,
  onToggleBgmMute,
  onToggleSfxMute,
}) => {
  const safeStepIdx = Math.max(
    0,
    Math.min(ENDING_STORY_STEPS.length - 1, ending.storyStepIndex)
  );
  const step = ENDING_STORY_STEPS[safeStepIdx];
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [step.imageSrc]);

  const isStoryPhase = ending.phase === 'STORY';
  const fadeAlpha = isStoryPhase ? 1 : ending.arrivalFadeAlpha;

  return (
    <>
      {/* PHASE 1: Short ~2.6s Snowflower Plaza Arrival Banner over Live Phaser Scene */}
      {!isStoryPhase && (
        <div
          data-testid="ending-arrival-banner"
          className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6"
          style={{ opacity: Math.max(0, 1 - fadeAlpha * 0.9) }}
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className="px-5 py-3 rounded-2xl shadow-lg"
              style={{
                backgroundColor: 'rgba(6, 18, 52, 0.9)',
                border: '1.5px solid rgba(253, 224, 71, 0.65)',
              }}
            >
              <div className="text-xs sm:text-sm font-extrabold text-amber-300">
                눈꽃광장 도착!
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm sm:text-base font-extrabold text-white tabular-nums">
                <span className="text-sky-200">가져온 눈꽃</span>
                <span className="flex items-center gap-1">
                  <NormalSnowflakeSvg className="w-5 h-5" />
                  {normalCount}
                </span>
                <span aria-hidden="true" className="text-sky-400/70">
                  ·
                </span>
                <span className="flex items-center gap-1 text-amber-300">
                  <GoldenSnowflakeSvg className="w-5 h-5" />
                  {goldenCount}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                data-ui-interactive="true"
                tabIndex={-1}
                onClick={onToggleBgmMute}
                aria-label={bgmMuted ? '배경음악 켜기' : '배경음악 끄기'}
                className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: 'rgba(6, 18, 52, 0.9)',
                  border: '1.5px solid rgba(125, 211, 252, 0.45)',
                }}
              >
                <BgmNoteIconSvg muted={bgmMuted} className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                  배경음
                </span>
              </button>

              <button
                type="button"
                data-ui-interactive="true"
                tabIndex={-1}
                onClick={onToggleSfxMute}
                aria-label={sfxMuted ? '효과음 켜기' : '효과음 끄기'}
                className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: 'rgba(6, 18, 52, 0.9)',
                  border: '1.5px solid rgba(125, 211, 252, 0.45)',
                }}
              >
                <SoundIconSvg muted={sfxMuted} className="w-5 h-5" />
                <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                  효과음
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: Crossfaded 2-Scene Illustrated Story Ending (`ending_01.png` -> `ending_02.png`) */}
      {fadeAlpha > 0.01 && (
        <section
          aria-label="엔딩 이야기"
          data-testid="ending-story-overlay"
          data-ui-interactive="true"
          style={{ opacity: fadeAlpha }}
          className={`fixed inset-0 z-30 bg-[#050c22] flex items-center justify-center p-0 overflow-y-auto md:overflow-hidden ${
            isStoryPhase ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="relative w-full min-h-full md:min-h-0 md:h-full md:max-w-[177.78vh] md:max-h-[56.25vw] bg-[#060f2b] flex flex-col justify-between md:block overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)]">
            {/* TOP BAR: Scene Indicator (Left) + Audio Toggles (Right) */}
            <div className="relative md:absolute md:top-0 md:inset-x-0 z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 md:py-4 md:bg-gradient-to-b md:from-[#040a1e]/80 md:via-[#040a1e]/35 md:to-transparent">
              <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-sky-100 tabular-nums">
                <span className="text-amber-300">엔딩</span>
                <span aria-hidden="true" className="text-sky-400/70">
                  ·
                </span>
                <span data-testid="ending-scene-indicator" className="text-white">
                  장면 {step.sceneNumber}/2
                </span>
              </div>

              {isStoryPhase && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-ui-interactive="true"
                    tabIndex={-1}
                    onClick={onToggleBgmMute}
                    aria-label={bgmMuted ? '배경음악 켜기' : '배경음악 끄기'}
                    className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: 'rgba(6, 18, 52, 0.9)',
                      border: '1.5px solid rgba(125, 211, 252, 0.42)',
                    }}
                  >
                    <BgmNoteIconSvg muted={bgmMuted} className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                      배경음
                    </span>
                  </button>

                  <button
                    type="button"
                    data-ui-interactive="true"
                    tabIndex={-1}
                    onClick={onToggleSfxMute}
                    aria-label={sfxMuted ? '효과음 켜기' : '효과음 끄기'}
                    className="h-10 px-2.5 rounded-xl flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: 'rgba(6, 18, 52, 0.9)',
                      border: '1.5px solid rgba(125, 211, 252, 0.42)',
                    }}
                  >
                    <SoundIconSvg muted={sfxMuted} className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-extrabold text-sky-100">
                      효과음
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* ILLUSTRATION FRAME WITH SUBTLE ZOOM & UPPER-SKY TWINKLE */}
            <div className="relative w-full aspect-video md:aspect-auto md:absolute md:inset-0 bg-[#071334] flex items-center justify-center overflow-hidden shrink-0">
              {!imgFailed ? (
                <img
                  key={`scene-${step.sceneNumber}`}
                  src={step.imageSrc}
                  alt={step.imageAlt}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-contain select-none story-slow-zoom"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-gradient-to-b from-[#08173d] to-[#050c22]">
                  <GoldenSnowflakeSvg className="w-12 h-12" />
                  <p className="text-base font-bold text-sky-100 break-keep">
                    {step.imageAlt}
                  </p>
                </div>
              )}

              {/* Subtle starlight twinkles confined strictly to the upper night sky (y: 7%..12%), never obscuring Songi or the cats */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden"
              >
                {SKY_TWINKLE_SPOTS.map((spot, idx) => (
                  <span
                    key={idx}
                    className="story-star-twinkle absolute w-2 h-2 rounded-full bg-amber-100 shadow-[0_0_10px_#fde047]"
                    style={{
                      left: spot.left,
                      top: spot.top,
                      animationDelay: spot.delay,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* BOTTOM SEMI-TRANSPARENT SUBTITLE & STEP ACTION PANEL */}
            {isStoryPhase && (
              <div
                className="relative md:absolute md:bottom-0 md:inset-x-0 z-20 flex-1 md:flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-4 sm:px-7 md:py-4"
                style={{
                  backgroundColor: 'rgba(5, 13, 36, 0.9)',
                  borderTop: '1.5px solid rgba(253, 224, 71, 0.42)',
                }}
              >
                <div className="space-y-1 text-left break-keep max-w-4xl">
                  {step.lines.map((line, idx) => (
                    <p
                      key={idx}
                      className="text-lg sm:text-xl md:text-[23px] lg:text-[26px] font-extrabold text-white leading-snug tracking-tight"
                    >
                      {line}
                    </p>
                  ))}

                  {step.finaleTitle && (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2
                        data-testid="ending-finale-title"
                        className="text-xl sm:text-2xl md:text-[27px] lg:text-[30px] font-extrabold text-amber-300 leading-tight tracking-tight"
                      >
                        {step.finaleTitle}
                      </h2>
                      {step.finaleSubtitle && (
                        <span className="text-xs sm:text-sm font-extrabold text-sky-200 tracking-wide">
                          {step.finaleSubtitle}
                        </span>
                      )}
                    </div>
                  )}

                  {step.playfulNote && (
                    <p className="text-base sm:text-lg md:text-[20px] font-bold text-sky-100 leading-snug">
                      {step.playfulNote}
                    </p>
                  )}

                  {step.isFinalStep && ending.isBonusUnlocked && step.bonusLine && (
                    <div
                      data-testid="ending-bonus-line"
                      className="pt-1 flex items-center gap-2 text-sm sm:text-base md:text-[18px] font-extrabold text-amber-200 leading-snug"
                    >
                      <CatPawStampSvg className="w-6 h-6 shrink-0" />
                      <span>{step.bonusLine}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    data-testid={
                      step.isFinalStep ? 'ending-to-result-btn' : 'ending-next-btn'
                    }
                    data-ui-interactive="true"
                    onClick={onNextStep}
                    className="h-12 px-7 rounded-xl text-base sm:text-lg font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 active:scale-95 transition-transform shadow-[0_4px_0_#b45309] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {step.buttonLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
};
