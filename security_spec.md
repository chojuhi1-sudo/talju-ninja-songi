# Security Specification — Runaway Ninja Songi Realtime Leaderboard

## Data Invariants

1. **Identity Ownership**: An authenticated anonymous user (`request.auth.uid`) may only create `score_runs/{runId}` with `userId == request.auth.uid`, and may only create or update their own `/leaderboard_v1_course_5314/{userId}` document (`userId == request.auth.uid`). Deleting any record is strictly forbidden.
2. **Score Formula Integrity**: On every write, `score` must be an integer equal to `distanceMeters + normalCount * 10 + goldenCount * 50`, with `0 <= normalCount <= 231`, `0 <= goldenCount <= 32`, `0 <= distanceMeters <= 1404`, and `0 <= score <= 5314`. If `cleared == true`, `distanceMeters >= 1339`.
3. **Rule Version Isolation**: Every document in `/leaderboard_v1_course_5314` and `/score_runs` must carry `ruleVersion == 'v1_course_5314'`.
4. **Monotonic High Score Preservation**: Updating `/leaderboard_v1_course_5314/{userId}` with a new score requires `incoming.score > existing.score` (strictly greater). Lower or equal scores can never reduce `score` or overwrite `achievedAt`.
5. **Run Deduplication & Atomicity**: `/score_runs/{runId}` is immutable create-only (`update` and `delete` denied). Every leaderboard create or high-score update requires `existsAfter(/databases/$(database)/documents/score_runs/$(incoming().bestRunId))` with matching `userId` and `score` in the same atomic transaction.
6. **Temporal Integrity & Cooldown**: All server timestamps (`submittedAt`, `achievedAt`, `updatedAt`, `lastSubmittedAt`) must equal `request.time`. Consecutive high-score updates require `request.time >= existing.lastSubmittedAt + duration.value(2, 's')`.
7. **PII Isolation & Nickname Sanitization**: Public leaderboard documents contain zero PII or auth tokens; `nickname` must match `^[가-힣a-zA-Z0-9_]{2,10}$`.

## The "Dirty Dozen" Adversarial Payloads (Must All Be Rejected)

1. **Unauthenticated Write**: `auth == null` attempting to create `/leaderboard_v1_course_5314/uidA`.
2. **Cross-User Overwrite (Identity Spoofing)**: User A attempting to update `/leaderboard_v1_course_5314/uidB`.
3. **Cross-User Deletion**: User A attempting to delete `/leaderboard_v1_course_5314/uidB` or `/score_runs/run1`.
4. **Negative / Out-of-Range Score**: `score: -100` or `score: 999999` or `normalCount: 500`.
5. **Formula Mismatch**: `distanceMeters: 100, normalCount: 5, goldenCount: 1, score: 5000` (expected `200`).
6. **Fake Clear Flag**: `cleared: true, distanceMeters: 50` (must be `>= 1339`).
7. **High-Score Downgrade**: User A with existing `score: 2500` attempting to update `score: 1200`.
8. **Duplicate Run ID Replay**: Attempting to overwrite an existing `/score_runs/{runId}` document.
9. **Orphaned Leaderboard Write**: Writing `/leaderboard_v1_course_5314/uidA` without atomically creating `/score_runs/{bestRunId}`.
10. **Shadow / Ghost Field Injection**: Including extra key `isAdmin: true` or `verified: true` in payload.
11. **Timestamp Forgery**: Providing a past/future client timestamp for `achievedAt` (`!= request.time`).
12. **Invalid Nickname / Oversized ID**: Nickname `<script>` or 25-char string, or 1.5KB document ID.
