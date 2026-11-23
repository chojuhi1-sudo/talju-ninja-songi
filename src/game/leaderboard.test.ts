import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_RULE_VERSION } from './config';
import {
  computeRankedLeaderboard,
  derivePublicTagCode,
  deriveStableTieBreaker,
  generateRunId,
  isRunEligibleForLeaderboard,
  validateNickname,
  validateRunSubmissionPayload,
} from './leaderboardLogic';
import { LeaderboardEntry } from './types';

test('validateNickname enforces 2-10 chars, trims whitespace, and allows only Korean/English/digits/underscore', () => {
  assert.equal(validateNickname('').valid, false);
  assert.equal(validateNickname('   ').valid, false);
  assert.equal(validateNickname('송').valid, false);
  assert.equal(validateNickname('열한글자닉네임테스트임').valid, false);
  assert.equal(validateNickname('송이 닌자').valid, false);
  assert.equal(validateNickname('<script>').valid, false);
  assert.equal(validateNickname('송이!@#').valid, false);

  const trimmed = validateNickname('  눈꽃_Songi9  ');
  assert.equal(trimmed.valid, true);
  assert.equal(trimmed.normalized, '눈꽃_Songi9');

  assert.equal(validateNickname('송이').valid, true);
  assert.equal(validateNickname('Ninja_01').valid, true);
});

test('derivePublicTagCode and deriveStableTieBreaker are deterministic and never expose raw UID', () => {
  const uidA = 'firebaseSecretAnonUidAlpha123456';
  const uidB = 'firebaseSecretAnonUidBeta987654';
  const tagA1 = derivePublicTagCode(uidA);
  const tagA2 = derivePublicTagCode(uidA);
  const tagB = derivePublicTagCode(uidB);

  assert.equal(tagA1, tagA2);
  assert.match(tagA1, /^[A-Z0-9]{4}$/);
  assert.match(tagB, /^[A-Z0-9]{4}$/);
  assert.notEqual(tagA1, tagB);
  assert.equal(uidA.includes(tagA1), false);

  const tbA = deriveStableTieBreaker(uidA);
  assert.match(tbA, /^[a-z0-9]{8,16}$/);
  assert.equal(tbA.includes('Alpha'), false);
});

test('validateRunSubmissionPayload enforces score formula, course bounds, clear distance, and finite integers', () => {
  const validGameOver = {
    runId: generateRunId(),
    nickname: '송이닌자',
    ruleVersion: GAME_RULE_VERSION,
    distanceMeters: 420,
    normalCount: 30,
    goldenCount: 2,
    score: 420 + 30 * 10 + 2 * 50, // 820
    cleared: false,
  };
  assert.equal(validateRunSubmissionPayload(validGameOver).valid, true);

  const validClear = {
    ...validGameOver,
    runId: generateRunId(),
    distanceMeters: 1350,
    normalCount: 200,
    goldenCount: 27,
    score: 1350 + 200 * 10 + 27 * 50, // 4700
    cleared: true,
  };
  assert.equal(validateRunSubmissionPayload(validClear).valid, true);

  // Reject negative, NaN, Infinity, float
  assert.equal(validateRunSubmissionPayload({ ...validGameOver, score: -10 }).valid, false);
  assert.equal(validateRunSubmissionPayload({ ...validGameOver, score: Number.NaN }).valid, false);
  assert.equal(
    validateRunSubmissionPayload({ ...validGameOver, score: Number.POSITIVE_INFINITY }).valid,
    false
  );
  assert.equal(validateRunSubmissionPayload({ ...validGameOver, distanceMeters: 12.5 }).valid, false);

  // Reject formula mismatch
  assert.equal(validateRunSubmissionPayload({ ...validGameOver, score: 999 }).valid, false);

  // Reject out-of-course bounds
  assert.equal(
    validateRunSubmissionPayload({
      ...validGameOver,
      normalCount: 232,
      score: 420 + 232 * 10 + 100,
    }).valid,
    false
  );
  assert.equal(
    validateRunSubmissionPayload({
      ...validGameOver,
      goldenCount: 33,
      score: 420 + 300 + 33 * 50,
    }).valid,
    false
  );

  // Reject fake clear flag with short distance
  assert.equal(
    validateRunSubmissionPayload({
      ...validGameOver,
      cleared: true,
    }).valid,
    false
  );

  // Reject mismatched rule version
  assert.equal(
    validateRunSubmissionPayload({
      ...validGameOver,
      ruleVersion: 'v0_old_course',
    }).valid,
    false
  );
});

test('computeRankedLeaderboard sorts by score DESC, achievedAt ASC, tieBreaker ASC, isolates versions, and handles >50 self', () => {
  const makeEntry = (
    id: string,
    score: number,
    achievedAtMs: number,
    tieBreaker: string,
    isSelf = false,
    ruleVersion: string = GAME_RULE_VERSION
  ): LeaderboardEntry => ({
    docId: id,
    isSelf,
    nickname: '송이',
    tagCode: 'A1B2',
    tieBreaker,
    ruleVersion,
    score,
    normalCount: 0,
    goldenCount: 0,
    distanceMeters: score,
    cleared: false,
    achievedAtMs,
  });

  const entries: LeaderboardEntry[] = [
    makeEntry('u_late', 500, 2000, 'aaaa0001'),
    makeEntry('u_early', 500, 1000, 'zzzz9999'),
    makeEntry('u_tie_b', 500, 1000, 'bbbb0002'),
    makeEntry('u_top', 1000, 3000, 'cccc0003'),
    makeEntry('u_old_ver', 5000, 500, '00000001', false, 'v0_legacy'),
  ];

  const ranked = computeRankedLeaderboard(entries, null, 50);
  assert.equal(ranked.topEntries.length, 4);
  assert.deepEqual(
    ranked.topEntries.map((r) => r.docId),
    ['u_top', 'u_tie_b', 'u_early', 'u_late']
  );

  // Top 50 cap & self outside Top 50 (never fabricates rank #51!)
  const crowd: LeaderboardEntry[] = Array.from({ length: 55 }, (_, i) =>
    makeEntry(`p_${i}`, 2000 - i * 10, 1000 + i, `tb${String(i).padStart(6, '0')}`)
  );
  const selfOutside = makeEntry('self_low', 120, 9999, 'self0001', true);
  const capped = computeRankedLeaderboard(crowd, selfOutside, 50);
  assert.equal(capped.topEntries.length, 50);
  assert.equal(capped.selfRank, null);
  assert.equal(capped.selfOutOfTop50?.docId, 'self_low');
});

test('isRunEligibleForLeaderboard excludes tutorial and dev runs', () => {
  assert.deepEqual(isRunEligibleForLeaderboard({ isTutorial: true, isDevRun: false }), {
    eligible: false,
    reason: 'tutorial',
  });
  assert.deepEqual(isRunEligibleForLeaderboard({ isTutorial: false, isDevRun: true }), {
    eligible: false,
    reason: 'dev',
  });
  assert.deepEqual(isRunEligibleForLeaderboard({ isTutorial: false, isDevRun: false }), {
    eligible: true,
    reason: null,
  });
});

test('firestore.rules enforces all Dirty Dozen security invariants', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.ok(rules.includes('allow read, write: if false;'));
  assert.ok(rules.includes('allow update, delete: if false;'));
  assert.ok(rules.includes('allow delete: if false;'));
  assert.ok(rules.includes('incoming().score > existing().score'));
  assert.ok(rules.includes('existsAfter(/databases/$(database)/documents/score_runs/$(runId))'));
  assert.ok(rules.includes('data.score == (data.distanceMeters + data.normalCount * 10 + data.goldenCount * 50)'));
  assert.ok(rules.includes("data.userId == request.auth.uid"));
});
