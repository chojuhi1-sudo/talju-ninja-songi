import { STORAGE_KEYS } from './config';

let memoryHighScore = 0;
let memoryBgmMuted = false;
let memorySfxMuted = false;

export function loadHighScore(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryHighScore;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.highScore);
    if (!raw) return memoryHighScore;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      memoryHighScore = parsed;
      return parsed;
    }
  } catch {
    // Ignore storage access errors in restricted iframe/private contexts
  }
  return memoryHighScore;
}

export function saveHighScore(score: number): number {
  const safeScore = Math.max(0, Math.floor(score));
  const prev = loadHighScore();
  const next = Math.max(prev, safeScore);
  memoryHighScore = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.highScore, String(next));
    }
  } catch {
    // Keep in-memory fallback silently
  }
  return next;
}

export function loadBgmMutedSetting(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryBgmMuted;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.bgmMuted);
    if (raw === '1' || raw === 'true') {
      memoryBgmMuted = true;
      return true;
    }
    if (raw === '0' || raw === 'false') {
      memoryBgmMuted = false;
      return false;
    }
  } catch {
    // Ignore storage errors
  }
  return memoryBgmMuted;
}

export function saveBgmMutedSetting(muted: boolean): void {
  memoryBgmMuted = muted;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.bgmMuted, muted ? '1' : '0');
    }
  } catch {
    // Keep in-memory fallback
  }
}

export function loadSfxMutedSetting(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memorySfxMuted;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.sfxMuted);
    if (raw === '1' || raw === 'true') {
      memorySfxMuted = true;
      return true;
    }
    if (raw === '0' || raw === 'false') {
      memorySfxMuted = false;
      return false;
    }
  } catch {
    // Ignore storage errors
  }
  return memorySfxMuted;
}

export function saveSfxMutedSetting(muted: boolean): void {
  memorySfxMuted = muted;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.sfxMuted, muted ? '1' : '0');
    }
  } catch {
    // Keep in-memory fallback
  }
}

let memorySnowflowerBadge = false;

export function loadSnowflowerBadgeUnlocked(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memorySnowflowerBadge;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.snowflowerBadge);
    if (raw === '1' || raw === 'true') {
      memorySnowflowerBadge = true;
      return true;
    }
  } catch {
    // Ignore storage errors
  }
  return memorySnowflowerBadge;
}

export function saveSnowflowerBadgeUnlocked(): void {
  memorySnowflowerBadge = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.snowflowerBadge, '1');
    }
  } catch {
    // Keep in-memory fallback
  }
}

let memoryNickname = '';

export function loadSavedNickname(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryNickname;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.nickname);
    if (typeof raw === 'string') {
      memoryNickname = raw;
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return memoryNickname;
}

export function saveNickname(nickname: string): void {
  const trimmed = nickname.trim();
  memoryNickname = trimmed;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.nickname, trimmed);
    }
  } catch {
    // Keep in-memory fallback
  }
}
