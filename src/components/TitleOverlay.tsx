import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { BgmNoteIconSvg, SoundIconSvg, TitleEmblemSvg } from './GameIcons';

interface TitleOverlayProps {
  highScore: number;
  nickname: string;
  publicTagCode: string | null;
  bgmMuted: boolean;
  sfxMuted: boolean;
  onRequestStart: () => void;
  onOpenIntro: () => void;
  onStartTutorial: () => void;
  onOpenLeaderboard: () => void;
  onEditNickname: () => void;
  onToggleBgmMute: () => void;
  onToggleSfxMute: () => void;
  onPlayClick: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  highScore,
  nickname,
  publicTagCode,
  bgmMuted,
  sfxMuted,
  onRequestStart,
  onOpenIntro,
  onStartTutorial,
  onOpenLeaderboard,
  onEditNickname,
  onToggleBgmMute,
  onToggleSfxMute,
  onPlayClick,
}) => {
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-5 sm:p-8 z-20">
      {/* Top Row: High-Contrast Best Score, Saved Nickname & Separate BGM / SFX Toggles */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap pointer-events-auto">
          <div
            className="px-4 py-2 rounded-xl text-sm sm:text-base font-bold text-white tabular-nums"
            style={{
              backgroundColor: 'rgba(6, 18, 52, 0.88)',
              border: '1.5px solid rgba(125, 211, 252, 0.42)',
            }}
          >
            최고기록{' '}
            <span className="text-amber-300 font-extrabold ml-1.5">
              {highScore.toLocaleString()}점
            </span>
          </div>

          {nickname && (
            <button
              type="button"
              data-testid="title-nickname-btn"
              data-ui-interactive="true"
              onClick={() => {
                onPlayClick();
                onEditNickname();
              }}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-sky-100 hover:text-white flex items-center gap-1.5 transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'rgba(6, 18, 52, 0.88)',
                border: '1.5px solid rgba(253, 224, 71, 0.42)',
              }}
              title="닉네임 변경"
            >
              <span className="text-amber-300 font-extrabold">{nickname}</span>
              {publicTagCode && (
                <span className="text-sky-300/80 text-xs tabular-nums">
                  #{publicTagCode}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            data-ui-interactive="true"
            tabIndex={-1}
            onClick={onToggleBgmMute}
            aria-label={bgmMuted ? '배경음악 켜기' : '배경음악 끄기'}
            className="h-11 px-3 rounded-xl flex items-center gap-1.5 transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'rgba(6, 18, 52, 0.9)',
              border: '1.5px solid rgba(125, 211, 252, 0.45)',
            }}
          >
            <BgmNoteIconSvg muted={bgmMuted} className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-extrabold text-sky-100">
              배경음
            </span>
          </button>

          <button
            type="button"
            data-ui-interactive="true"
            tabIndex={-1}
            onClick={onToggleSfxMute}
            aria-label={sfxMuted ? '효과음 켜기' : '효과음 끄기'}
            className="h-11 px-3 rounded-xl flex items-center gap-1.5 transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              backgroundColor: 'rgba(6, 18, 52, 0.9)',
              border: '1.5px solid rgba(125, 211, 252, 0.45)',
            }}
          >
            <SoundIconSvg muted={sfxMuted} className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-extrabold text-sky-100">
              효과음
            </span>
          </button>
        </div>
      </div>

      {/* Upper-Center Calm Sky Region: Title Emblem, One-line Intro & Menu Actions */}
      <div className="flex flex-col items-center text-center -mt-14 sm:-mt-24">
        <TitleEmblemSvg />

        <p className="mt-2 text-base sm:text-lg font-bold text-white text-stroke-navy tracking-tight">
          “과제는 내일의 송이에게. 오늘의 송이는 탈주한다!”
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
          <button
            type="button"
            data-start="true"
            data-ui-interactive="true"
            onClick={() => {
              onPlayClick();
              onRequestStart();
            }}
            className="px-8 py-3.5 rounded-xl text-lg font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 active:scale-95 transition-transform duration-150 shadow-[0_6px_0_#b45309] cursor-pointer whitespace-nowrap shrink-0"
          >
            탈주 시작
          </button>

          <button
            type="button"
            data-testid="title-leaderboard-btn"
            data-ui-interactive="true"
            onClick={() => {
              onPlayClick();
              onOpenLeaderboard();
            }}
            className="px-5 py-3.5 rounded-xl text-base font-extrabold text-amber-200 hover:text-white active:scale-95 transition-transform duration-150 border border-amber-300/60 shadow-[0_5px_0_#05153d] flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'rgba(10, 34, 88, 0.94)' }}
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>순위표</span>
          </button>

          <button
            type="button"
            data-ui-interactive="true"
            onClick={onStartTutorial}
            className="px-5 py-3.5 rounded-xl text-base font-bold text-white bg-[#003087] hover:bg-[#0a3fa3] active:scale-95 transition-transform duration-150 border border-sky-300/60 shadow-[0_5px_0_#05153d] cursor-pointer whitespace-nowrap shrink-0"
          >
            연습하기
          </button>

          <button
            type="button"
            data-testid="title-replay-story-btn"
            data-ui-interactive="true"
            onClick={onOpenIntro}
            className="px-5 py-3.5 rounded-xl text-base font-bold text-amber-200 hover:text-white active:scale-95 transition-transform duration-150 border border-amber-300/50 cursor-pointer whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'rgba(7, 20, 56, 0.92)' }}
          >
            이야기 다시 보기
          </button>

          <button
            type="button"
            data-ui-interactive="true"
            onClick={() => {
              onPlayClick();
              setShowControls(true);
            }}
            className="px-5 py-3.5 rounded-xl text-base font-bold text-sky-100 hover:text-white active:scale-95 transition-transform duration-150 border border-sky-300/45 cursor-pointer whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'rgba(7, 20, 56, 0.9)' }}
          >
            조작 방법
          </button>
        </div>
      </div>

      {/* Bottom Single Flat Control-Hint Line */}
      <div className="text-center">
        <p className="text-xs sm:text-sm font-semibold text-white text-stroke-navy tracking-wide">
          좌클릭 / Space / 터치: 점프 · 공중에서 다시 길게 누르기: 와이어 연결 · 손 떼기: 비행 · Esc: 일시정지
        </p>
      </div>

      {/* Controls Guide Modal */}
      {showControls && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="controls-modal-title"
          data-ui-interactive="true"
          className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(4, 10, 28, 0.8)' }}
          onClick={() => setShowControls(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 sm:p-7 text-left shadow-2xl"
            style={{
              backgroundColor: '#08173d',
              border: '1.5px solid rgba(125, 211, 252, 0.52)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-sky-300/20">
              <h2 id="controls-modal-title" className="text-xl font-extrabold text-white">
                조작 방법 안내
              </h2>
              <span className="text-xs font-bold text-sky-300">
                마우스 좌클릭 · Space · 모바일 터치 동일
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm sm:text-base text-slate-100 leading-relaxed">
              <div>
                <span className="font-bold text-amber-300">1. 점프하기</span>
                <span className="mx-2 text-sky-300">·</span>
                <span>지상에서 새로 누르면 옥상 위로 경쾌하게 점프합니다.</span>
              </div>
              <div>
                <span className="font-bold text-sky-300">2. 와이어 발사 &amp; 매달리기</span>
                <span className="mx-2 text-sky-300">·</span>
                <span>
                  점프 후 손을 뗐다가 공중에서 다시 길게 누르면 밝게 표시된 전방 고리에 와이어를 겁니다.
                </span>
              </div>
              <div>
                <span className="font-bold text-sky-300">3. 흔들리기 &amp; 날아가기</span>
                <span className="mx-2 text-sky-300">·</span>
                <span>
                  누르고 있는 동안 진자처럼 흔들리며, 앞으로 솟구칠 때 손을 떼면 관성을 유지해 멀리 날아갑니다.
                </span>
              </div>
              <div>
                <span className="font-bold text-amber-300">4. 눈꽃 수집 &amp; 코스 돌파</span>
                <span className="mx-2 text-sky-300">·</span>
                <span>
                  일반 눈꽃(+10점)과 황금 눈꽃(+50점)을 모으며 순헌관 → 명신관 언덕 → 눈꽃광장까지 도착하세요!
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                data-ui-interactive="true"
                onClick={() => {
                  setShowControls(false);
                  onStartTutorial();
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-[#003087] hover:bg-[#0a3fa3] border border-sky-300/50 cursor-pointer whitespace-nowrap"
              >
                연습 코스로 배우기
              </button>
              <button
                type="button"
                data-ui-interactive="true"
                onClick={() => {
                  onPlayClick();
                  setShowControls(false);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
