import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  NICKNAME_MAX_LENGTH,
  validateNickname,
} from '../game/leaderboardLogic';

interface NicknameModalProps {
  initialNickname: string;
  publicTagCode: string | null;
  confirmLabel?: string;
  onConfirm: (normalizedNickname: string) => void;
  onCancel: () => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({
  initialNickname,
  publicTagCode,
  confirmLabel = '확정하고 탈주 시작',
  onConfirm,
  onCancel,
}) => {
  const [rawInput, setRawInput] = useState(initialNickname);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRawInput(initialNickname);
  }, [initialNickname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const validation = useMemo(() => validateNickname(rawInput), [rawInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validation.valid) return;
    onConfirm(validation.normalized);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-modal-title"
      data-testid="nickname-modal"
      data-ui-interactive="true"
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(4, 10, 28, 0.84)' }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl p-6 sm:p-7 text-left shadow-2xl"
        style={{
          backgroundColor: '#08173d',
          border: '1.5px solid rgba(253, 224, 71, 0.58)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="nickname-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-amber-300"
            >
              탈주 닉네임 설정
            </h2>
            <p className="mt-1 text-sm font-semibold text-sky-200">
              순위표에 공개되는 닉네임입니다
            </p>
          </div>
          {publicTagCode && (
            <span
              data-testid="nickname-tag-preview"
              className="px-2.5 py-1 rounded-lg text-xs font-extrabold text-sky-200 tabular-nums shrink-0"
              style={{
                backgroundColor: 'rgba(5, 13, 36, 0.88)',
                border: '1px solid rgba(125, 211, 252, 0.35)',
              }}
              title="동일 닉네임 구분용 공개 코드"
            >
              #{publicTagCode}
            </span>
          )}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="songi-nickname-input"
              className="text-xs sm:text-sm font-bold text-sky-100"
            >
              닉네임 (2~10자)
            </label>
            <span className="text-xs font-bold text-sky-300 tabular-nums">
              {validation.normalized.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>

          <input
            ref={inputRef}
            id="songi-nickname-input"
            data-testid="nickname-input"
            data-ui-interactive="true"
            type="text"
            value={rawInput}
            maxLength={14}
            autoComplete="nickname"
            placeholder="예: 눈꽃송이"
            onChange={(e) => {
              setRawInput(e.target.value);
              if (!touched) setTouched(true);
            }}
            className="w-full h-12 px-4 rounded-xl text-base font-extrabold text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-300"
            style={{
              backgroundColor: 'rgba(5, 13, 36, 0.94)',
              border:
                touched && !validation.valid
                  ? '1.5px solid rgba(248, 113, 113, 0.85)'
                  : '1.5px solid rgba(125, 211, 252, 0.45)',
            }}
          />

          <p className="mt-2 text-xs text-sky-200/90 leading-relaxed break-keep">
            한글, 영문, 숫자, 밑줄(_)만 입력할 수 있으며 앞뒤 공백은 자동으로 제거됩니다.
            같은 닉네임도 사용할 수 있으며 짧은 구분 코드로 구분됩니다.
          </p>

          {touched && !validation.valid && validation.error && (
            <p
              role="alert"
              data-testid="nickname-error"
              className="mt-2 text-xs sm:text-sm font-bold text-rose-300"
            >
              {validation.error}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            data-ui-interactive="true"
            onClick={onCancel}
            className="px-5 py-3 rounded-xl text-sm sm:text-base font-semibold text-sky-100 hover:text-white border border-sky-300/35 cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: 'rgba(6, 15, 42, 0.9)' }}
          >
            취소
          </button>
          <button
            type="submit"
            data-testid="nickname-confirm-btn"
            data-ui-interactive="true"
            disabled={!validation.valid}
            className={`flex-1 py-3 rounded-xl text-sm sm:text-base font-extrabold whitespace-nowrap transition-transform ${
              validation.valid
                ? 'text-slate-950 bg-amber-300 hover:bg-amber-200 active:scale-95 shadow-[0_4px_0_#b45309] cursor-pointer'
                : 'text-slate-400 bg-slate-700/80 cursor-not-allowed'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
