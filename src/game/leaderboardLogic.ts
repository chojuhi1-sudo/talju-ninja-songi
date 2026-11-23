import {
  COURSE_VALIDATION_BOUNDS,
  GAME_RULE_VERSION,
  LEADERBOARD_CONFIG,
  SCORE_CONFIG,
} from './config';
import { LeaderboardEntry, RankedLeaderboardEntry, RunStats } from './types';

// Mirrors firebase-blueprint.json & firestore.rules verbatim
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,10}$/;
export const RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export interface NicknameValidationResult {
  valid: boolean;
  normalized: string;
  error: string | null;
}

export function normalizeNickname(raw: string): string {
  return raw.trim();
}

export function validateNickname(raw: string): NicknameValidationResult {
  const normalized = normalizeNickname(raw);
  if (normalized.length === 0) {
    return {
      valid: false,
      normalized,
      error: '닉네임을 입력해 주세요. (2~10자)',
    };
  }
  if (normalized.length < NICKNAME_MIN_LENGTH || normalized.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      normalized,
      error: '닉네임은 공백을 제외하고 2~10자로 입력해 주세요.',
    };
  }
  if (!NICKNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: '한글(완성형), 영문, 숫자, 밑줄(_)만 사용할 수 있습니다.',
    };
  }
  return {
    valid: true,
    normalized,
    error: null,
  };
}

/**
 * Computes a deterministic 32-bit FNV-1a hash from an arbitrary string.
 * Used strictly to derive a short public discriminator code (#XXXX) and stable tie-breaker
 * without ever exposing the user's raw internal Firebase UID on the public leaderboard.
 */
function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const TAG_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a short 4-character uppercase alphanumeric discriminator code (e.g. "K7M4")
 * from the internal user ID so identical nicknames can be distinguished without exposing UID.
 */
export function derivePublicTagCode(uid: string): string {
  const h = fnv1a32(`songi-tag:${uid}`);
  let out = '';
  let val = h;
  for (let i = 0; i < 4; i++) {
    out += TAG_ALPHABET[val % TAG_ALPHABET.length];
    val = Math.floor(val / TAG_ALPHABET.length);
  }
  return out;
}

/**
 * Generates a stable, deterministic 10-char lowercase alphanumeric tie-breaking key
 * that never leaks the raw Firebase Auth UID.
 */
export function deriveStableTieBreaker(uid: string): string {
  const h1 = fnv1a32(`songi-tb-a:${uid}`, 0x811c9dc5).toString(36).padStart(7, '0');
  const h2 = fnv1a32(`songi-tb-b:${uid}`, 0x9e3779b9).toString(36).padStart(7, '0');
  return (h1 + h2).slice(0, 12).replace(/[^a-z0-9]/g, '0');
}

/**
 * Generates a unique run identifier per play session adhering to `^[a-zA-Z0-9_-]{8,64}$`.
 */
export function generateRunId(): string {
  const ts = Date.now().toString(36);
  let rand = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      rand += bytes[i].toString(16).padStart(2, '0');
    }
  } else {
    rand =
      Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, '0') +
      Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, '0');
  }
  return `run_${ts}_${rand}`.slice(0, 48);
}

export interface RunSubmissionPayload {
  runId: string;
  nickname: string;
  ruleVersion: string;
  score: number;
  normalCount: number;
  goldenCount: number;
  distanceMeters: number;
  cleared: boolean;
}

export interface PayloadValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Mirrors firestore.rules `isValidScorePayload` & `isValidScoreRun` checks so invalid payloads
 * are caught early on the client as well as enforced authoritatively by Firestore security rules.
 */
export function validateRunSubmissionPayload(
  payload: RunSubmissionPayload
): PayloadValidationResult {
  if (!RUN_ID_PATTERN.test(payload.runId)) {
    return { valid: false, reason: '유효하지 않은 판 식별자(runId)입니다.' };
  }
  const nick = validateNickname(payload.nickname);
  if (!nick.valid) {
    return { valid: false, reason: nick.error ?? '유효하지 않은 닉네임입니다.' };
  }
  if (payload.ruleVersion !== GAME_RULE_VERSION) {
    return { valid: false, reason: '현재 게임 규칙 버전과 일치하지 않습니다.' };
  }

  const numericFields: Array<[string, number]> = [
    ['score', payload.score],
    ['normalCount', payload.normalCount],
    ['goldenCount', payload.goldenCount],
    ['distanceMeters', payload.distanceMeters],
  ];
  for (const [name, val] of numericFields) {
    if (!Number.isFinite(val) || !Number.isInteger(val) || val < 0) {
      return { valid: false, reason: `잘못된 수치(${name})입니다.` };
    }
  }

  if (payload.normalCount > COURSE_VALIDATION_BOUNDS.maxNormalCount) {
    return { valid: false, reason: '일반 눈꽃 수가 코스 최대치를 초과했습니다.' };
  }
  if (payload.goldenCount > COURSE_VALIDATION_BOUNDS.maxGoldenCount) {
    return { valid: false, reason: '황금 눈꽃 수가 코스 최대치를 초과했습니다.' };
  }
  if (payload.distanceMeters > COURSE_VALIDATION_BOUNDS.maxDistanceMeters) {
    return { valid: false, reason: '이동 거리가 코스 최대치를 초과했습니다.' };
  }
  if (
    payload.cleared &&
    payload.distanceMeters < COURSE_VALIDATION_BOUNDS.minClearedDistanceMeters
  ) {
    return { valid: false, reason: '클리어 거리 조건을 충족하지 않습니다.' };
  }

  const expectedScore =
    payload.distanceMeters +
    payload.normalCount * SCORE_CONFIG.normalSnowflakePoints +
    payload.goldenCount * SCORE_CONFIG.goldenSnowflakePoints;

  if (
    payload.score !== expectedScore ||
    payload.score > COURSE_VALIDATION_BOUNDS.maxScore
  ) {
    return { valid: false, reason: '점수 공식과 제출 데이터가 일치하지 않습니다.' };
  }

  return { valid: true };
}

export function isRunEligibleForLeaderboard(
  stats: Pick<RunStats, 'isTutorial' | 'isDevRun'>
): { eligible: boolean; reason: 'tutorial' | 'dev' | null } {
  if (stats.isTutorial) {
    return { eligible: false, reason: 'tutorial' };
  }
  if (stats.isDevRun) {
    return { eligible: false, reason: 'dev' };
  }
  return { eligible: true, reason: null };
}

/**
 * Deterministic 3-level leaderboard comparator:
 * 1. Highest score first (DESC)
 * 2. Earlier achievement time first on ties (ASC)
 * 3. Stable tie-breaker key (ASC)
 */
export function compareLeaderboardEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry
): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.achievedAtMs !== b.achievedAtMs) {
    return a.achievedAtMs - b.achievedAtMs;
  }
  return a.tieBreaker.localeCompare(b.tieBreaker);
}

export interface RankedLeaderboardResult {
  topEntries: RankedLeaderboardEntry[];
  selfRank: number | null;
  selfOutOfTop50: LeaderboardEntry | null;
}

/**
 * Sorts raw leaderboard entries for the active rule version, slices top N (default 50),
 * and accurately places the current user either at their top-50 rank or in `selfOutOfTop50`
 * without ever fabricating a global rank outside Top 50.
 */
export function computeRankedLeaderboard(
  entries: readonly LeaderboardEntry[],
  selfEntry: LeaderboardEntry | null,
  topLimit: number = LEADERBOARD_CONFIG.topLimit
): RankedLeaderboardResult {
  const versionEntries = entries.filter((e) => e.ruleVersion === GAME_RULE_VERSION);
  const sorted = [...versionEntries].sort(compareLeaderboardEntries);
  const topSlice = sorted.slice(0, topLimit);
  const topEntries: RankedLeaderboardEntry[] = topSlice.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  const selfInTop = topEntries.find((e) => e.isSelf) ?? null;
  if (selfInTop) {
    return {
      topEntries,
      selfRank: selfInTop.rank,
      selfOutOfTop50: null,
    };
  }

  const validSelf =
    selfEntry && selfEntry.ruleVersion === GAME_RULE_VERSION ? selfEntry : null;

  return {
    topEntries,
    selfRank: null,
    selfOutOfTop50: validSelf,
  };
}
