import {
  collection,
  doc,
  DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { GAME_RULE_VERSION, LEADERBOARD_CONFIG } from '../game/config';
import {
  computeRankedLeaderboard,
  derivePublicTagCode,
  deriveStableTieBreaker,
  RankedLeaderboardResult,
  RunSubmissionPayload,
  validateNickname,
  validateRunSubmissionPayload,
} from '../game/leaderboardLogic';
import { LeaderboardEntry, ScoreSubmissionState } from '../game/types';
import {
  db,
  ensureAnonymousUser,
  isAnonymousAuthDisabledError,
  logFirestoreError,
  OperationType,
} from './client';

let activeLeaderboardSubscribers = 0;

export function getActiveLeaderboardSubscriberCount(): number {
  return activeLeaderboardSubscribers;
}

function parseTimestampMs(raw: unknown): number {
  if (raw instanceof Timestamp) {
    return raw.toMillis();
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'toMillis' in raw &&
    typeof (raw as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  return Date.now();
}

function mapDocToLeaderboardEntry(
  docId: string,
  data: DocumentData,
  currentUid: string
): LeaderboardEntry {
  return {
    docId,
    isSelf: docId === currentUid,
    nickname: typeof data.nickname === 'string' ? data.nickname : '송이',
    tagCode: typeof data.tagCode === 'string' ? data.tagCode : '0000',
    tieBreaker: typeof data.tieBreaker === 'string' ? data.tieBreaker : docId,
    ruleVersion:
      typeof data.ruleVersion === 'string' ? data.ruleVersion : GAME_RULE_VERSION,
    score: typeof data.score === 'number' ? data.score : 0,
    normalCount: typeof data.normalCount === 'number' ? data.normalCount : 0,
    goldenCount: typeof data.goldenCount === 'number' ? data.goldenCount : 0,
    distanceMeters:
      typeof data.distanceMeters === 'number' ? data.distanceMeters : 0,
    cleared: Boolean(data.cleared),
    achievedAtMs: parseTimestampMs(data.achievedAt),
  };
}

let lastSubmissionAttemptAtMs = 0;

/**
 * Atomically records a single official run (`score_runs/{runId}`) and updates
 * the player's public best-score document (`leaderboard_v1_course_5314/{uid}`)
 * ONLY if the new score strictly beats their previous best score.
 *
 * - Uses Firestore `runTransaction` to guarantee monotonic high-score preservation under concurrency.
 * - Uses immutable `score_runs/{runId}` to prevent duplicate registration on retries or replays.
 * - Returns an explicit state without ever pretending a failed write succeeded.
 */
export async function submitRunScore(
  payload: RunSubmissionPayload
): Promise<ScoreSubmissionState> {
  const nickCheck = validateNickname(payload.nickname);
  if (!nickCheck.valid) {
    return {
      status: 'failed',
      runId: payload.runId,
      message: nickCheck.error ?? '닉네임 형식이 올바르지 않습니다.',
    };
  }

  const normalizedPayload: RunSubmissionPayload = {
    ...payload,
    nickname: nickCheck.normalized,
  };

  const payloadCheck = validateRunSubmissionPayload(normalizedPayload);
  if (!payloadCheck.valid) {
    return {
      status: 'failed',
      runId: payload.runId,
      message: payloadCheck.reason ?? '제출 데이터가 유효하지 않습니다.',
    };
  }

  // Gentle client-side pacing aligned with server-side 2s cooldown in firestore.rules
  const nowMs = Date.now();
  const waitMs = LEADERBOARD_CONFIG.minSubmitCooldownMs - (nowMs - lastSubmissionAttemptAtMs);
  if (waitMs > 0 && waitMs <= LEADERBOARD_CONFIG.minSubmitCooldownMs) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastSubmissionAttemptAtMs = Date.now();

  const authRes = await ensureAnonymousUser();
  if (!authRes.user) {
    return {
      status: 'failed',
      runId: payload.runId,
      needsAnonymousAuthEnable: authRes.needsAnonymousAuthEnable,
      message:
        authRes.errorMessage ??
        '온라인 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  const uid = authRes.user.uid;
  const tagCode = derivePublicTagCode(uid);
  const tieBreaker = deriveStableTieBreaker(uid);
  const scoreRunPath = `${LEADERBOARD_CONFIG.scoreRunsCollection}/${normalizedPayload.runId}`;
  const leaderboardPath = `${LEADERBOARD_CONFIG.collectionName}/${uid}`;

  const scoreRunRef = doc(
    db,
    LEADERBOARD_CONFIG.scoreRunsCollection,
    normalizedPayload.runId
  );
  const leaderboardRef = doc(db, LEADERBOARD_CONFIG.collectionName, uid);

  try {
    const txResult = await runTransaction(db, async (tx) => {
      const [existingRunSnap, existingBestSnap] = await Promise.all([
        tx.get(scoreRunRef),
        tx.get(leaderboardRef),
      ]);

      // Exact same runId was already recorded on the server -> idempotent no-op!
      if (existingRunSnap.exists()) {
        const bestData = existingBestSnap.exists() ? existingBestSnap.data() : null;
        const bestScore =
          bestData && typeof bestData.score === 'number'
            ? bestData.score
            : normalizedPayload.score;
        const wasBestRun = bestData?.bestRunId === normalizedPayload.runId;
        return {
          status: wasBestRun ? ('registered' as const) : ('kept_best' as const),
          bestScore,
        };
      }

      // 1. Write immutable per-run record for deduplication & server-rule atomicity check
      tx.set(scoreRunRef, {
        runId: normalizedPayload.runId,
        userId: uid,
        nickname: normalizedPayload.nickname,
        tagCode,
        ruleVersion: GAME_RULE_VERSION,
        score: normalizedPayload.score,
        normalCount: normalizedPayload.normalCount,
        goldenCount: normalizedPayload.goldenCount,
        distanceMeters: normalizedPayload.distanceMeters,
        cleared: normalizedPayload.cleared,
        submittedAt: serverTimestamp(),
      });

      // 2. Create or atomically update user's best-score leaderboard document
      if (!existingBestSnap.exists()) {
        tx.set(leaderboardRef, {
          userId: uid,
          nickname: normalizedPayload.nickname,
          tagCode,
          tieBreaker,
          ruleVersion: GAME_RULE_VERSION,
          score: normalizedPayload.score,
          normalCount: normalizedPayload.normalCount,
          goldenCount: normalizedPayload.goldenCount,
          distanceMeters: normalizedPayload.distanceMeters,
          cleared: normalizedPayload.cleared,
          bestRunId: normalizedPayload.runId,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastSubmittedAt: serverTimestamp(),
        });
        return {
          status: 'registered' as const,
          bestScore: normalizedPayload.score,
        };
      }

      const prev = existingBestSnap.data();
      const prevScore = typeof prev.score === 'number' ? prev.score : 0;

      if (normalizedPayload.score > prevScore) {
        tx.update(leaderboardRef, {
          nickname: normalizedPayload.nickname,
          score: normalizedPayload.score,
          normalCount: normalizedPayload.normalCount,
          goldenCount: normalizedPayload.goldenCount,
          distanceMeters: normalizedPayload.distanceMeters,
          cleared: normalizedPayload.cleared,
          bestRunId: normalizedPayload.runId,
          achievedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastSubmittedAt: serverTimestamp(),
        });
        return {
          status: 'registered' as const,
          bestScore: normalizedPayload.score,
        };
      }

      // Lower or equal score: strictly preserve previous high score & earlier achievedAt!
      // Optionally sync nickname if changed and cooldown has elapsed.
      const prevUpdatedMs = parseTimestampMs(prev.updatedAt);
      if (
        prev.nickname !== normalizedPayload.nickname &&
        Date.now() - prevUpdatedMs >= 2600
      ) {
        tx.update(leaderboardRef, {
          nickname: normalizedPayload.nickname,
          updatedAt: serverTimestamp(),
        });
      }

      return {
        status: 'kept_best' as const,
        bestScore: prevScore,
      };
    });

    return {
      status: txResult.status,
      runId: normalizedPayload.runId,
      bestScore: txResult.bestScore,
      message:
        txResult.status === 'registered'
          ? '온라인 랭킹에 최고기록이 등록되었습니다.'
          : `기존 개인 최고기록(${txResult.bestScore.toLocaleString()}점)이 유지됩니다.`,
    };
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, `${scoreRunPath} -> ${leaderboardPath}`);
    const needsEnable = isAnonymousAuthDisabledError(error);
    const errMsg = error instanceof Error ? error.message : String(error);
    const isQuota = errMsg.includes('Quota exceeded') || errMsg.includes('resource-exhausted');
    return {
      status: 'failed',
      runId: normalizedPayload.runId,
      needsAnonymousAuthEnable: needsEnable,
      message: isQuota
        ? '오늘의 데이터베이스 무료 할당량을 초과했습니다. 내일 다시 시도해 주세요.'
        : '기록 서버 등록에 실패했습니다. 다시 시도해 주세요.',
    };
  }
}

export interface LeaderboardSubscriptionHandlers {
  onData: (result: RankedLeaderboardResult) => void;
  onError: (info: {
    message: string;
    needsAnonymousAuthEnable?: boolean;
  }) => void;
}

/**
 * Subscribes in real time (Firestore `onSnapshot`) to the Top 50 leaderboard entries
 * for the active rule version AND the current anonymous user's own entry.
 * Call the returned cleanup function immediately when closing the leaderboard modal.
 */
export function subscribeToRealtimeLeaderboard(
  handlers: LeaderboardSubscriptionHandlers
): () => void {
  let cancelled = false;
  let unsubList: Unsubscribe | null = null;
  let unsubSelf: Unsubscribe | null = null;
  let counted = false;

  const detach = () => {
    if (unsubList) {
      unsubList();
      unsubList = null;
    }
    if (unsubSelf) {
      unsubSelf();
      unsubSelf = null;
    }
    if (counted) {
      activeLeaderboardSubscribers = Math.max(0, activeLeaderboardSubscribers - 1);
      counted = false;
    }
  };

  void (async () => {
    const authRes = await ensureAnonymousUser();
    if (cancelled) return;

    if (!authRes.user) {
      handlers.onError({
        message:
          authRes.errorMessage ??
          '익명 인증 연결에 실패해 실시간 순위표를 불러올 수 없습니다.',
        needsAnonymousAuthEnable: authRes.needsAnonymousAuthEnable,
      });
      return;
    }

    const uid = authRes.user.uid;
    let latestTopList: LeaderboardEntry[] = [];
    let latestSelfEntry: LeaderboardEntry | null = null;
    let listReady = false;

    const emitRanked = () => {
      if (cancelled || !listReady) return;
      const ranked = computeRankedLeaderboard(
        latestTopList,
        latestSelfEntry,
        LEADERBOARD_CONFIG.topLimit
      );
      handlers.onData(ranked);
    };

    const topQuery = query(
      collection(db, LEADERBOARD_CONFIG.collectionName),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(LEADERBOARD_CONFIG.queryLimit)
    );
    const selfDocRef = doc(db, LEADERBOARD_CONFIG.collectionName, uid);

    activeLeaderboardSubscribers++;
    counted = true;

    unsubList = onSnapshot(
      topQuery,
      (snapshot) => {
        if (cancelled) return;
        latestTopList = snapshot.docs.map((d) =>
          mapDocToLeaderboardEntry(d.id, d.data(), uid)
        );
        listReady = true;
        emitRanked();
      },
      (error) => {
        if (cancelled) return;
        logFirestoreError(error, OperationType.LIST, LEADERBOARD_CONFIG.collectionName);
        const msg = error instanceof Error ? error.message : String(error);
        handlers.onError({
          message: msg.includes('Quota exceeded')
            ? '오늘의 무료 읽기 할당량을 초과해 순위표를 불러올 수 없습니다.'
            : '실시간 순위표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        });
      }
    );

    unsubSelf = onSnapshot(
      selfDocRef,
      (snap) => {
        if (cancelled) return;
        latestSelfEntry = snap.exists()
          ? mapDocToLeaderboardEntry(snap.id, snap.data(), uid)
          : null;
        emitRanked();
      },
      (error) => {
        if (cancelled) return;
        logFirestoreError(
          error,
          OperationType.GET,
          `${LEADERBOARD_CONFIG.collectionName}/${uid}`
        );
      }
    );
  })();

  return () => {
    cancelled = true;
    detach();
  };
}
