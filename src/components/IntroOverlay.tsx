import React, { useEffect, useState } from 'react';
import { INTRO_SLIDES } from '../game/story';
import {
  BgmNoteIconSvg,
  CatPawStampSvg,
  NormalSnowflakeSvg,
  SoundIconSvg,
} from './GameIcons';

interface IntroOverlayProps {
  stepIndex: number;
  bgmMuted: boolean;
  sfxMuted: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onToggleBgmMute: () => void;
  onToggleSfxMute: () => void;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({
  stepIndex,
  bgmMuted,
  sfxMuted,
  onNext,
  onPrev,
  onSkip,
  onToggleBgmMute,
  onToggleSfxMute,
}) => {
  const safeIndex = Math.max(0, Math.min(INTRO_SLIDES.length - 1, stepIndex));
  const slide = INTRO_SLIDES[safeIndex];
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [slide.imageSrc]);

  return (
    <section
      aria-label="인트로 이야기"
      data-testid="intro-overlay"
      data-ui-interactive="true"
      className="fixed inset-0 z-30 bg-[#050c22] flex items-center justify-center p-0 overflow-y-auto md:overflow-hidden"
    >
      {/* Responsive Stage Container: Vertical non-overlapping stack on mobile (< md), 16:9 aspect stage on desktop (md+) */}
      <div className="relative w-full min-h-full md:min-h-0 md:h-full md:max-w-[177.78vh] md:max-h-[56.25vw] bg-[#060f2b] flex flex-col justify-between md:block overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)]">
        {/* TOP BAR: Page Indicator (Left) + Audio Mute & Skip (Right) */}
        <div className="relative md:absolute md:top-0 md:inset-x-0 z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 md:py-4 md:bg-gradient-to-b md:from-[#040a1e]/85 md:via-[#040a1e]/40 md:to-transparent">
          <div className="flex items-center gap-2.5 text-sm sm:text-base font-extrabold text-sky-100 tabular-nums">
            <span className="text-amber-300">이야기</span>
            <span aria-hidden="true" className="text-sky-400/70">
              ·
            </span>
            <span data-testid="intro-page-indicator" className="text-white">
              {slide.pageLabel}
            </span>
          </div>

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

            <button
              type="button"
              data-testid="intro-skip-btn"
              data-ui-interactive="true"
              onClick={onSkip}
              className="h-10 px-4 rounded-xl text-xs sm:text-sm font-extrabold text-sky-100 hover:text-white active:scale-95 transition-transform cursor-pointer whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'rgba(7, 20, 56, 0.92)',
                border: '1.5px solid rgba(125, 211, 252, 0.5)',
              }}
            >
              건너뛰기
            </button>
          </div>
        </div>

        {/* MAIN ILLUSTRATION FRAME: 16:9 aspect-preserved with resilient fallback */}
        <div className="relative w-full aspect-video md:aspect-auto md:absolute md:inset-0 bg-[#071334] flex items-center justify-center overflow-hidden shrink-0">
          {!imgFailed ? (
            <img
              key={slide.imageSrc}
              src={slide.imageSrc}
              alt={slide.imageAlt}
              referrerPolicy="no-referrer"
              draggable={false}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-contain select-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-gradient-to-b from-[#08173d] to-[#050c22]">
              <NormalSnowflakeSvg className="w-12 h-12" />
              <p className="text-base font-bold text-sky-100 break-keep">
                {slide.imageAlt}
              </p>
            </div>
          )}
        </div>

        {/* SLIDE 2 LETTER CARD UI: Stacked cleanly below image on mobile; anchored on right windowsill/desk corner on desktop (never covering Songi's invitation!) */}
        {slide.letterCard && (
          <div className="px-4 pt-3 md:p-0 md:absolute md:right-6 lg:right-8 md:bottom-[22.5%] md:w-[340px] lg:w-[376px] z-20">
            <div
              data-testid="intro-letter-card"
              className="rounded-2xl px-5 py-4 shadow-[0_12px_32px_rgba(3,8,24,0.85)]"
              style={{
                backgroundColor: 'rgba(255, 250, 235, 0.96)',
                border: '2px solid #FDE047',
              }}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-900/15">
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#003087]">
                  <NormalSnowflakeSvg className="w-4 h-4" />
                  눈꽃 초대장
                </span>
                <span className="text-xs font-bold text-amber-800">
                  먹밥이의 편지
                </span>
              </div>

              <div className="space-y-1 text-base lg:text-[18px] font-extrabold text-[#071438] leading-snug break-keep">
                {slide.letterCard.lines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>

              <div className="mt-2.5 flex items-center justify-end gap-2 text-xs sm:text-sm font-extrabold text-rose-700">
                <span>{slide.letterCard.signature}</span>
                <CatPawStampSvg className="w-6 h-6 shrink-0" />
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM SEMI-TRANSPARENT SUBTITLE & NAVIGATION PANEL */}
        <div
          className="relative md:absolute md:bottom-0 md:inset-x-0 z-20 flex-1 md:flex-none flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-4 sm:px-7 md:py-4"
          style={{
            backgroundColor: 'rgba(5, 13, 36, 0.9)',
            borderTop: '1.5px solid rgba(125, 211, 252, 0.35)',
          }}
        >
          <div className="space-y-1 text-left break-keep max-w-3xl">
            {slide.lines.map((line, idx) => (
              <p
                key={idx}
                className="text-lg sm:text-xl md:text-[24px] lg:text-[27px] font-extrabold text-white leading-snug tracking-tight"
              >
                {line}
              </p>
            ))}

            {slide.subCaption && (
              <p className="pt-0.5 text-base sm:text-lg md:text-[20px] font-bold text-amber-200 leading-snug">
                {slide.subCaption}
              </p>
            )}

            {slide.guideHint && (
              <p className="pt-0.5 text-sm sm:text-base md:text-[17px] font-extrabold text-sky-300 leading-snug">
                {slide.guideHint}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 shrink-0">
            {safeIndex >= 1 && (
              <button
                type="button"
                data-testid="intro-prev-btn"
                data-ui-interactive="true"
                onClick={onPrev}
                className="h-12 px-5 rounded-xl text-base font-bold text-sky-100 hover:text-white active:scale-95 transition-transform border border-sky-300/45 cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(8, 23, 61, 0.95)' }}
              >
                이전
              </button>
            )}

            <button
              type="button"
              data-testid="intro-next-btn"
              data-start={slide.isFinalSlide ? 'true' : undefined}
              data-ui-interactive="true"
              onClick={onNext}
              className="h-12 px-7 rounded-xl text-base sm:text-lg font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 active:scale-95 transition-transform shadow-[0_4px_0_#b45309] cursor-pointer whitespace-nowrap shrink-0"
            >
              {slide.nextButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
