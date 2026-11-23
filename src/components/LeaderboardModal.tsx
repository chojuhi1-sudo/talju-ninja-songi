import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Medal, RefreshCw, Trophy, X } from 'lucide-react';
import { FIREBASE_AUTH_PROVIDERS_URL, FIREBASE_PROJECT_ID } from '../firebase/client';
import { subscribeToRealtimeLeaderboard } from '../firebase/leaderboardService';
import { GAME_RULE_VERSION } from '../game/config';
import { RankedLeaderboardResult } from '../game/leaderboardLogic';

interface LeaderboardModalProps {
  onClose: () => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        aria-label="1위 금메달"
        className="inline-flex items-center justify-center gap-1 font-extrabold text-amber-300"
      >
        <Trophy className="w-4 h-4 text-amber-300" />
        <span>1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        aria-label="2위 은메달"
        className="inline-flex items-center justify-center gap-1 font-extrabold text-slate-200"
      >
        <Medal className="w-4 h-4 text-slate-200" />
        <span>2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        aria-label="3위 동메달"
        className="inline-flex items-center justify-center gap-1 font-extrabold text-amber-500"
      >
        <Award className="w-4 h-4 text-amber-500" />
        <span>3</span>
      </span>
    );
  }
  return <span className="font-bold text-sky-200">{rank}</span>;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [ranked, setRanked] = useState<RankedLeaderboardResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsAnonEnable, setNeedsAnonEnable] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Subscribe strictly while modal is open and cleanly unsubscribe on close/unmount
  useEffect(() => {
    setLoading(true);
    setErrorMsg(null);
    setNeedsAnonEnable(false);

    const unsubscribe = subscribeToRealtimeLeaderboard({
      onData: (result) => {
        setRanked(result);
        setLoading(false);
        setErrorMsg(null);
        setNeedsAnonEnable(false);
      },
      onError: (err) => {
        setLoading(false);
        setErrorMsg(err.message);
        setNeedsAnonEnable(Boolean(err.needsAnonymousAuthEnable));
      },
    });

    return () => {
      unsubscribe();
    };
  }, [retryNonce]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const entries = ranked?.topEntries ?? [];
  const selfOutOfTop50 = ranked?.selfOutOfTop50 ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
      data-testid="leaderboard-modal"
      data-ui-interactive="true"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(4, 10, 28, 0.84)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor: '#08173d',
          border: '1.5px solid rgba(125, 211, 252, 0.52)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'rgba(5, 13, 36, 0.92)',
            borderBottom: '1px solid rgba(125, 211, 252, 0.25)',
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Trophy className="w-5 h-5 text-amber-300 shrink-0" />
              <h2
                id="leaderboard-modal-title"
                className="text-lg sm:text-xl font-extrabold text-white"
              >
                실시간 온라인 랭킹
              </h2>
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-bold text-sky-200 tabular-nums"
                style={{
                  backgroundColor: 'rgba(14, 41, 102, 0.85)',
                  border: '1px solid rgba(125, 211, 252, 0.35)',
                }}
              >
                규칙 {GAME_RULE_VERSION}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-sky-200/85">
              상위 50명 최고기록 · 새 기록이 등록되면 새로고침 없이 자동 갱신됩니다
            </p>
          </div>

          <button
            type="button"
            data-testid="leaderboard-close-btn"
            data-ui-interactive="true"
            onClick={onClose}
            aria-label="순위표 닫기"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sky-100 hover:text-white hover:bg-sky-900/60 border border-sky-300/35 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
          {loading ? (
            <div
              data-testid="leaderboard-loading"
              className="py-14 flex flex-col items-center justify-center gap-3 text-sky-200"
            >
              <RefreshCw className="w-6 h-6 animate-spin text-amber-300" />
              <p className="text-sm font-bold">온라인 순위표를 불러오는 중...</p>
            </div>
          ) : errorMsg ? (
            <div
              data-testid="leaderboard-error"
              className="my-6 rounded-xl p-5 text-left space-y-3"
              style={{
                backgroundColor: 'rgba(5, 13, 36, 0.88)',
                border: '1px solid rgba(248, 113, 113, 0.45)',
              }}
            >
              <div className="text-base font-extrabold text-rose-300">
                온라인 순위표 연결 실패
              </div>
              <p className="text-sm text-sky-100 leading-relaxed break-keep">
                {errorMsg}
              </p>

              {needsAnonEnable && (
                <div
                  className="rounded-lg p-3.5 text-xs sm:text-sm text-amber-100 space-y-1.5 leading-relaxed break-keep"
                  style={{
                    backgroundColor: 'rgba(120, 53, 15, 0.35)',
                    border: '1px solid rgba(251, 191, 36, 0.45)',
                  }}
                >
                  <div className="font-extrabold text-amber-300">
                    Firebase 콘솔 익명 인증 설정 경로 ({FIREBASE_PROJECT_ID})
                  </div>
                  <p>
                    Firebase 콘솔 → Authentication → Sign-in method(로그인 방법) → 새
                    제공업체 추가 → <strong>익명(Anonymous)</strong> 사용 설정 → 저장
                  </p>
                  <a
                    href={FIREBASE_AUTH_PROVIDERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-ui-interactive="true"
                    className="inline-block mt-1 font-bold text-sky-300 underline hover:text-sky-200"
                  >
                    Firebase Authentication 설정 페이지 열기
                  </a>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  data-ui-interactive="true"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="px-4 py-2 rounded-lg text-sm font-extrabold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer"
                >
                  다시 연결
                </button>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div
              data-testid="leaderboard-empty"
              className="py-14 text-center space-y-2"
            >
              <p className="text-base font-extrabold text-white">
                아직 등록된 온라인 기록이 없습니다
              </p>
              <p className="text-sm text-sky-200/85">
                첫 번째로 눈꽃광장 탈주 기록을 남겨 보세요!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs font-bold text-sky-300 border-b border-sky-300/20">
                    <th className="py-2.5 px-2 w-16 text-center">순위</th>
                    <th className="py-2.5 px-2">닉네임</th>
                    <th className="py-2.5 px-2 text-right w-28">최고점</th>
                    <th className="py-2.5 px-2 text-center w-24">클리어</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-300/12 text-sm">
                  {entries.map((row) => (
                    <tr
                      key={row.docId}
                      data-testid={
                        row.isSelf ? 'leaderboard-self-row' : 'leaderboard-row'
                      }
                      className={
                        row.isSelf
                          ? 'bg-amber-300/15 ring-1 ring-inset ring-amber-300/70'
                          : 'hover:bg-sky-900/25'
                      }
                    >
                      <td className="py-2.5 px-2 text-center tabular-nums">
                        <RankBadge rank={row.rank} />
                      </td>
                      <td className="py-2.5 px-2 font-bold text-white">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{row.nickname}</span>
                          <span className="text-xs font-semibold text-sky-300/75 tabular-nums shrink-0">
                            #{row.tagCode}
                          </span>
                          {row.isSelf && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-slate-950 bg-amber-300 shrink-0">
                              나
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-amber-200 tabular-nums">
                        {row.score.toLocaleString()}점
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {row.cleared ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            클리어
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dedicated Footer Box when current user's best record is outside Top 50 */}
        {!loading && !errorMsg && selfOutOfTop50 && (
          <div
            data-testid="leaderboard-out-of-top50"
            className="px-5 py-3 shrink-0 flex items-center justify-between gap-3 text-sm"
            style={{
              backgroundColor: 'rgba(13, 35, 86, 0.96)',
              borderTop: '1.5px solid rgba(253, 224, 71, 0.55)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded text-xs font-extrabold text-slate-950 bg-amber-300 shrink-0">
                상위 50위 밖
              </span>
              <span className="font-extrabold text-white truncate">
                {selfOutOfTop50.nickname}
              </span>
              <span className="text-xs font-semibold text-sky-300/80 tabular-nums shrink-0">
                #{selfOutOfTop50.tagCode}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 tabular-nums">
              <span className="font-extrabold text-amber-300">
                {selfOutOfTop50.score.toLocaleString()}점
              </span>
              {selfOutOfTop50.cleared ? (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  클리어
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-400">—</span>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between gap-3 text-xs text-sky-200/80 shrink-0"
          style={{
            backgroundColor: 'rgba(5, 13, 36, 0.94)',
            borderTop: '1px solid rgba(125, 211, 252, 0.2)',
          }}
        >
          <span>정렬: 최고점 우선 · 동점 시 먼저 달성한 기록 우선</span>
          <button
            type="button"
            data-ui-interactive="true"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-slate-950 bg-amber-300 hover:bg-amber-200 cursor-pointer whitespace-nowrap"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
