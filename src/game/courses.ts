import { COURSE_BOUNDS } from './config';
import {
  ChallengeClusterDef,
  CourseData,
  GuideSignDef,
  PlatformDef,
  RingDef,
  SnowflakeDef,
} from './types';

function pushSpacedSnowflake(list: SnowflakeDef[], candidate: SnowflakeDef): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const existing = list[i];
    if (Math.abs(existing.x - candidate.x) > 68) continue;
    const dist = Math.hypot(existing.x - candidate.x, existing.y - candidate.y);
    if (dist < 60) {
      // Golden snowflakes take visual priority over normal snowflakes at intersections
      if (candidate.kind === 'golden' && existing.kind === 'normal') {
        list.splice(i, 1);
        break;
      }
      return;
    }
  }
  list.push(candidate);
}

function addArcSnowflakes(
  list: SnowflakeDef[],
  prefix: string,
  startX: number,
  endX: number,
  baseY: number,
  peakLift: number,
  count: number,
  goldenIndices: number[] = []
): void {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = Math.round(startX + (endX - startX) * t);
    const parabola = 4 * t * (1 - t);
    const y = Math.round(baseY - peakLift * parabola);
    pushSpacedSnowflake(list, {
      id: `${prefix}_${i}`,
      x,
      y,
      kind: goldenIndices.includes(i) ? 'golden' : 'normal',
      collected: false,
    });
  }
}

function addLineSnowflakes(
  list: SnowflakeDef[],
  prefix: string,
  startX: number,
  y: number,
  spacing: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    pushSpacedSnowflake(list, {
      id: `${prefix}_${i}`,
      x: Math.round(startX + i * spacing),
      y: Math.round(y),
      kind: 'normal',
      collected: false,
    });
  }
}

/**
 * Guided Practice / Tutorial Course (~17-20s at 430 px/s):
 * 1. Safe flat jump practice
 * 2. Small rooftop gap jump (~205px)
 * 3. Highlighted first mandatory wire swing (~680px chasm, checkpoint recovery if fallen)
 * 4. Practice arrival terrace
 */
export function buildTutorialCourse(): CourseData {
  const floorY: number = COURSE_BOUNDS.defaultFloorY; // 492

  const platforms: PlatformDef[] = [
    { id: 'tut_p1', x: 0, y: floorY, width: 2820 },
    { id: 'tut_p2', x: 3025, y: floorY, width: 2050 }, // 205px small jump gap
    { id: 'tut_p3', x: 5755, y: floorY, width: 1520 }, // 680px mandatory wire chasm
    { id: 'tut_p4', x: 7485, y: floorY, width: 1450, isArrival: true },
  ];

  const rings: RingDef[] = [
    { id: 'tut_r1', x: 5380, y: 130, isFirstHighlight: true },
  ];

  const snowflakes: SnowflakeDef[] = [];
  addLineSnowflakes(snowflakes, 'tut_s1_flat', 880, floorY - 52, 110, 3);
  addArcSnowflakes(snowflakes, 'tut_s1_jump', 1480, 1920, floorY - 56, 104, 5);
  addLineSnowflakes(snowflakes, 'tut_s1_run2', 2240, floorY - 52, 110, 3);

  addArcSnowflakes(snowflakes, 'tut_s2_gap', 2780, 3160, floorY - 54, 102, 4);
  addLineSnowflakes(snowflakes, 'tut_s2_run', 3580, floorY - 52, 114, 4);

  addArcSnowflakes(snowflakes, 'tut_s3_swing', 5210, 5670, 418, -34, 4);
  pushSpacedSnowflake(snowflakes, {
    id: 'tut_s3_gold',
    x: 5665,
    y: floorY - 205,
    kind: 'golden',
    collected: false,
  });

  addLineSnowflakes(snowflakes, 'tut_s4_run', 6120, floorY - 52, 114, 4);
  addArcSnowflakes(snowflakes, 'tut_s4_hop', 7240, 7600, floorY - 54, 98, 4);

  const guides: GuideSignDef[] = [
    {
      id: 'g1',
      x: 1120,
      y: 288,
      title: '1단계 · 기본 점프',
      subtitle: '좌클릭 · Space · 화면 터치로 점프해 눈꽃을 모아보세요',
    },
    {
      id: 'g2',
      x: 2780,
      y: 288,
      title: '2단계 · 작은 틈 넘기',
      subtitle: '발판 끝에서 타이밍 맞춰 점프하세요',
    },
    {
      id: 'g3',
      x: 4920,
      y: 278,
      title: '3단계 · 와이어 액션',
      subtitle: '점프 후 공중에서 다시 길게 눌러 고리를 잡고, 앞으로 솟구칠 때 손을 떼세요!',
    },
  ];

  return {
    mode: 'tutorial',
    startX: COURSE_BOUNDS.startX,
    startY: floorY,
    stage1EndX: 2800,
    stage2EndX: 5500,
    arrivalStartX: 7530,
    totalEndX: 8935,
    wireCheckpoint: {
      x: 4380,
      y: floorY,
      triggerAfterX: 4200,
    },
    platforms,
    rings,
    snowflakes,
    guides,
  };
}

/**
 * Builds the deterministic ~95-112s 3-Stage Main Course (target: 90~120s)
 * engineered strictly from actual physics reach (g=1950, vy0=-710, maxWireRange=475, vx=455..635):
 *
 * - Stage 1 (순헌관 야간 탈출 — 기본 와이어 익히기):
 *   First ~7.5s safe basic-jump section, followed by 4 mandatory single-wire chasms (720~765px,
 *   unbypassable by jumping or infinite holding), highlighted 1st ring, wide safe landings,
 *   and distinct safe normal vs precision-release golden snowflake trajectories.
 *
 * - Stage 2 (명신관 언덕 돌파 — 재연결과 해제 타이밍):
 *   5 mandatory wire challenge clusters separated by safe recovery terraces:
 *   * S2-C1 (Pattern A): Steep uphill & downhill elevation wire crossings
 *   * S2-C2 (Pattern B #1): Mandatory mid-air A->B ring re-connection (1,240px abyss)
 *   * S2-C3 (Pattern C): Release-timing split route (early -> safe lower deck, optimal upswing -> golden upper deck)
 *   * S2-C4 (Pattern D): Wire -> short 295px mid-chasm stone pier -> immediate jump + wire
 *   * S2-C5 (Pattern B #2): Mandatory uphill staggered A->B ring re-connection (1,260px abyss)
 *
 * - Stage 3 (눈꽃광장으로! — 연속 와이어 종합 도전):
 *   4 mandatory multi-wire challenge clusters with narrower landings (480~580px):
 *   * S3-C1: Floorless A->B->C triple-wire cascade #1 (1,740px abyss, varied ring heights/spacings)
 *   * S3-C2: Floorless A->B double-wire -> short 300px pier -> uphill split-deck wire vault
 *   * S3-C3: Floorless A->B->C triple-wire wave #2 (1,790px abyss, dive & steep upward vault)
 *   * S3-C4: Comprehensive Finale (step jump -> wire -> short 285px pier -> A->B->C triple-wire finale -> 2,600px Snowflower Plaza!)
 */
export function buildMainCourse(): CourseData {
  const platforms: PlatformDef[] = [];
  const rings: RingDef[] = [];
  const snowflakes: SnowflakeDef[] = [];
  const guides: GuideSignDef[] = [];
  const challenges: ChallengeClusterDef[] = [];

  let pIdx = 0;
  let rIdx = 0;
  let sIdx = 0;

  const addPlat = (
    x: number,
    y: number,
    width: number,
    isArrival = false
  ): PlatformDef => {
    const p: PlatformDef = {
      id: `mp_${++pIdx}`,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      isArrival,
    };
    platforms.push(p);
    return p;
  };

  const addRing = (
    x: number,
    y: number,
    isFirstHighlight = false
  ): RingDef => {
    const r: RingDef = {
      id: `mr_${++rIdx}`,
      x: Math.round(x),
      y: Math.round(y),
      isFirstHighlight,
    };
    rings.push(r);
    return r;
  };

  const populatePlatformRunSnowflakes = (plat: PlatformDef, maxCount = 3) => {
    if (plat.width < 680) return;
    const usable = plat.width - 420;
    const count = Math.min(maxCount, Math.max(2, Math.floor(usable / 122)));
    addLineSnowflakes(
      snowflakes,
      `ms_run_${++sIdx}`,
      plat.x + 200,
      plat.y - 52,
      118,
      count
    );
  };

  const baseFloorY: number = COURSE_BOUNDS.defaultFloorY; // 492
  let currentPlat = addPlat(0, baseFloorY, 1660);
  addLineSnowflakes(snowflakes, `ms_open_${++sIdx}`, 760, baseFloorY - 52, 114, 5);

  guides.push({
    id: 'mg_s1_intro',
    x: 780,
    y: 298,
    title: '1구간 · 순헌관 야간 탈출',
    subtitle: '처음은 가볍게 점프하며 달리고, 넓은 틈에서는 고리에 와이어를 거세요',
  });

  // Helper: Standard jumpable rooftop gap (180~270px)
  const appendJumpStep = (
    gapWidth: number,
    nextY: number,
    nextWidth: number,
    withHighGolden = false
  ): PlatformDef => {
    const fromX = currentPlat.x + currentPlat.width;
    const fromY = currentPlat.y;
    const clampedY = Math.max(408, Math.min(518, nextY));
    const nextX = fromX + gapWidth;
    const nextPlat = addPlat(nextX, clampedY, nextWidth);

    const midY = Math.min(fromY, clampedY);
    addArcSnowflakes(
      snowflakes,
      `ms_jmp_${++sIdx}`,
      fromX - 24,
      nextX + 44,
      midY - 54,
      90,
      3
    );

    populatePlatformRunSnowflakes(nextPlat, nextWidth >= 1000 ? 4 : 3);

    if (withHighGolden && nextWidth >= 780) {
      pushSpacedSnowflake(snowflakes, {
        id: `ms_gold_${++sIdx}`,
        x: nextX + Math.round(nextWidth * 0.56),
        y: clampedY - 156,
        kind: 'golden',
        collected: false,
      });
    }

    currentPlat = nextPlat;
    return nextPlat;
  };

  // Helper: Mandatory single-wire chasm (680~800px — strictly unbypassable by jump or infinite hold!)
  const appendMandatorySingleWire = (opts: {
    id: string;
    stageId: 1 | 2 | 3;
    label: string;
    chasmWidth: number;
    ringOffsetX: number;
    ringY: number;
    nextY: number;
    nextWidth: number;
    isFirstHighlight?: boolean;
    kindOverride?: ChallengeClusterDef['kind'];
  }): PlatformDef => {
    const launchPlat = currentPlat;
    const fromX = launchPlat.x + launchPlat.width;
    const fromY = launchPlat.y;
    const nextX = fromX + opts.chasmWidth;
    const nextY = Math.max(412, Math.min(518, opts.nextY));

    const ring = addRing(
      fromX + opts.ringOffsetX,
      opts.ringY,
      Boolean(opts.isFirstHighlight)
    );
    const landPlat = addPlat(nextX, nextY, opts.nextWidth);

    // Safe lower swing & comfortable mid-release normal snowflake path
    addArcSnowflakes(
      snowflakes,
      `ms_sw_${++sIdx}`,
      ring.x - 105,
      ring.x + 145,
      Math.min(fromY, nextY) - 62,
      -34,
      3
    );
    addArcSnowflakes(
      snowflakes,
      `ms_sw_land_${++sIdx}`,
      ring.x + 245,
      nextX + 55,
      nextY - 62,
      64,
      2
    );

    // Higher precision-release Golden Snowflake path (requires holding further into upswing!)
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: nextX - 92,
      y: Math.min(fromY, nextY) - 204,
      kind: 'golden',
      collected: false,
    });

    populatePlatformRunSnowflakes(landPlat, opts.nextWidth >= 1050 ? 4 : 3);

    challenges.push({
      id: opts.id,
      stageId: opts.stageId,
      kind: opts.kindOverride ?? 'single-wire',
      label: opts.label,
      startPlatId: launchPlat.id,
      startX: Math.max(launchPlat.x + 60, fromX - 420),
      chasmStartX: fromX,
      endX: nextX,
      ringIds: [ring.id],
      minRequiredRings: 1,
    });

    currentPlat = landPlat;
    return landPlat;
  };

  // Helper: Mandatory floorless A->B double-wire chasm (1,220~1,300px)
  const appendMandatoryDoubleWire = (opts: {
    id: string;
    stageId: 2 | 3;
    label: string;
    chasmWidth: number;
    r1OffsetX: number;
    r1Y: number;
    r2OffsetX: number;
    r2Y: number;
    nextY: number;
    nextWidth: number;
    recordChallenge?: boolean;
  }): { rings: [RingDef, RingDef]; landPlat: PlatformDef } => {
    const launchPlat = currentPlat;
    const fromX = launchPlat.x + launchPlat.width;
    const nextX = fromX + opts.chasmWidth;
    const nextY = Math.max(428, Math.min(516, opts.nextY));

    const r1 = addRing(fromX + opts.r1OffsetX, opts.r1Y);
    const r2 = addRing(fromX + opts.r2OffsetX, opts.r2Y);
    const landPlat = addPlat(nextX, nextY, opts.nextWidth);

    // Safe clear Normal Snowflakes along pendulum bellies
    addArcSnowflakes(
      snowflakes,
      `ms_dw1_${++sIdx}`,
      r1.x - 90,
      r1.x + 120,
      r1.y + 286,
      -26,
      3
    );
    addArcSnowflakes(
      snowflakes,
      `ms_dw2_${++sIdx}`,
      r2.x - 85,
      r2.x + 130,
      r2.y + 286,
      -26,
      3
    );

    // Riskier high-apex Golden Snowflakes at A->B transfer peak & B->landing launch
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: Math.round((r1.x + r2.x) * 0.5 + 18),
      y: Math.min(r1.y, r2.y) + 146,
      kind: 'golden',
      collected: false,
    });
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: nextX - 88,
      y: nextY - 208,
      kind: 'golden',
      collected: false,
    });

    populatePlatformRunSnowflakes(landPlat, 3);

    if (opts.recordChallenge !== false) {
      challenges.push({
        id: opts.id,
        stageId: opts.stageId,
        kind: 'double-wire',
        label: opts.label,
        startPlatId: launchPlat.id,
        startX: Math.max(launchPlat.x + 60, fromX - 420),
        chasmStartX: fromX,
        endX: nextX,
        ringIds: [r1.id, r2.id],
        minRequiredRings: 2,
      });
    }

    currentPlat = landPlat;
    return { rings: [r1, r2], landPlat };
  };

  // Helper: Mandatory floorless A->B->C triple-wire chasm (1,720~1,810px — zero mid-floor!)
  const appendMandatoryTripleWire = (opts: {
    id: string;
    stageId: 3;
    label: string;
    chasmWidth: number;
    r1OffsetX: number;
    r1Y: number;
    r2OffsetX: number;
    r2Y: number;
    r3OffsetX: number;
    r3Y: number;
    nextY: number;
    nextWidth: number;
    isArrival?: boolean;
    recordChallenge?: boolean;
  }): { rings: [RingDef, RingDef, RingDef]; landPlat: PlatformDef } => {
    const launchPlat = currentPlat;
    const fromX = launchPlat.x + launchPlat.width;
    const nextX = fromX + opts.chasmWidth;
    const nextY = Math.max(432, Math.min(516, opts.nextY));

    const r1 = addRing(fromX + opts.r1OffsetX, opts.r1Y);
    const r2 = addRing(fromX + opts.r2OffsetX, opts.r2Y);
    const r3 = addRing(fromX + opts.r3OffsetX, opts.r3Y);
    const landPlat = addPlat(nextX, nextY, opts.nextWidth, Boolean(opts.isArrival));

    // Safe route Normal Snowflakes guiding each swing belly
    addArcSnowflakes(
      snowflakes,
      `ms_tw1_${++sIdx}`,
      r1.x - 80,
      r1.x + 115,
      r1.y + 285,
      -24,
      3
    );
    addArcSnowflakes(
      snowflakes,
      `ms_tw2_${++sIdx}`,
      r2.x - 80,
      r2.x + 115,
      r2.y + 285,
      -24,
      3
    );
    addArcSnowflakes(
      snowflakes,
      `ms_tw3_${++sIdx}`,
      r3.x - 80,
      r3.x + 125,
      r3.y + 285,
      -24,
      3
    );

    // High-skill Golden Snowflakes at high transfer peaks (completely optional for safe clear!)
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: Math.round((r1.x + r2.x) * 0.5 + 16),
      y: Math.min(r1.y, r2.y) + 138,
      kind: 'golden',
      collected: false,
    });
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: Math.round((r2.x + r3.x) * 0.5 + 16),
      y: Math.min(r2.y, r3.y) + 136,
      kind: 'golden',
      collected: false,
    });
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: nextX - 92,
      y: nextY - 212,
      kind: 'golden',
      collected: false,
    });

    if (!opts.isArrival) {
      populatePlatformRunSnowflakes(landPlat, 2);
    }

    if (opts.recordChallenge !== false) {
      challenges.push({
        id: opts.id,
        stageId: opts.stageId,
        kind: 'triple-wire',
        label: opts.label,
        startPlatId: launchPlat.id,
        startX: Math.max(launchPlat.x + 50, fromX - 400),
        chasmStartX: fromX,
        endX: nextX,
        ringIds: [r1.id, r2.id, r3.id],
        minRequiredRings: 3,
      });
    }

    currentPlat = landPlat;
    return { rings: [r1, r2, r3], landPlat };
  };

  // ===========================================================================
  // STAGE 1: 순헌관 야간 탈출 — 기본 와이어 익히기 (0% ~ 28%, ~33s)
  // - First ~7.6 seconds (x: 285 -> 3,895): safe basic jump warm-up
  // - 4 mandatory single-wire chasms (720~765px) with wide safe landings (1,180~1,380px)
  // ===========================================================================
  appendJumpStep(180, 492, 940, false); // x: 1840..2780
  appendJumpStep(195, 478, 920, true); // x: 2975..3895 (~7.7s elapsed before 1st wire chasm!)

  guides.push({
    id: 'mg_s1_first_wire',
    x: currentPlat.x + currentPlat.width - 360,
    y: 286,
    title: '첫 필수 와이어!',
    subtitle: '발판 끝 점프 → 공중에서 다시 길게 눌러 빛나는 첫 고리를 잡으세요',
  });

  // Stage 1 Mandatory Wire #1 (First highlighted ring!)
  appendMandatorySingleWire({
    id: 'S1-W1',
    stageId: 1,
    label: '1구간 필수 단일 와이어 #1 (첫 강조 고리)',
    chasmWidth: 685,
    ringOffsetX: 295,
    ringY: 96,
    nextY: 486,
    nextWidth: 1260,
    isFirstHighlight: true,
  });

  appendJumpStep(200, 472, 980, false);

  // Stage 1 Mandatory Wire #2
  appendMandatorySingleWire({
    id: 'S1-W2',
    stageId: 1,
    label: '1구간 필수 단일 와이어 #2 (순헌관 회랑 도약)',
    chasmWidth: 705,
    ringOffsetX: 300,
    ringY: 94,
    nextY: 494,
    nextWidth: 1220,
  });

  appendJumpStep(205, 476, 940, true);
  appendJumpStep(210, 492, 980, false);

  // Stage 1 Mandatory Wire #3
  appendMandatorySingleWire({
    id: 'S1-W3',
    stageId: 1,
    label: '1구간 필수 단일 와이어 #3 (옥상 완만한 상승)',
    chasmWidth: 695,
    ringOffsetX: 295,
    ringY: 88,
    nextY: 468,
    nextWidth: 1220,
  });

  appendJumpStep(210, 488, 980, true);

  // Stage 1 Mandatory Wire #4 (Stage 1 Graduation Crossing)
  const stage2EntryPlat = appendMandatorySingleWire({
    id: 'S1-W4',
    stageId: 1,
    label: '1구간 필수 단일 와이어 #4 (순헌관 탈출 관문)',
    chasmWidth: 715,
    ringOffsetX: 305,
    ringY: 90,
    nextY: 484,
    nextWidth: 1460,
  });

  const actualStage1EndX = stage2EntryPlat.x + 120;

  // ===========================================================================
  // STAGE 2: 명신관 언덕 돌파 — 재연결과 해제 타이밍 (28% ~ 64%, ~36s)
  // 5 Mandatory Wire Clusters covering Patterns A, B (x2), C, and D:
  // ===========================================================================
  guides.push({
    id: 'mg_s2_intro',
    x: stage2EntryPlat.x + 560,
    y: 288,
    title: '2구간 · 재연결과 해제 타이밍',
    subtitle: '언덕 고저차를 넘고, 넓은 낭떠러지에서는 고리 A→B로 공중 재연결하세요!',
  });

  // --- Cluster S2-C1 (Pattern A: 높이가 다른 발판 사이를 와이어로 넘기) ---
  appendJumpStep(225, 512, 880, false);
  appendMandatorySingleWire({
    id: 'S2-C1A',
    stageId: 2,
    kindOverride: 'elevation-wire',
    label: '2구간 패턴 A-1 (낮은 발판→높은 언덕 상승 와이어)',
    chasmWidth: 640,
    ringOffsetX: 295,
    ringY: 74,
    nextY: 444, // -68px steep uphill climb!
    nextWidth: 840,
  });
  appendJumpStep(230, 434, 760, true);
  appendMandatorySingleWire({
    id: 'S2-C1B',
    stageId: 2,
    kindOverride: 'elevation-wire',
    label: '2구간 패턴 A-2 (높은 언덕→아래 테라스 활강 와이어)',
    chasmWidth: 745,
    ringOffsetX: 310,
    ringY: 88,
    nextY: 504, // +70px downhill glide onto safe rest platform!
    nextWidth: 1080,
  });

  // --- Cluster S2-C2 (Pattern B #1: 고리 A에서 해제 후 공중에서 고리 B로 재연결) ---
  appendJumpStep(235, 486, 900, false);
  appendMandatoryDoubleWire({
    id: 'S2-C2',
    stageId: 2,
    label: '2구간 패턴 B #1 (필수 A→B 고리 공중 재연결)',
    chasmWidth: 1150,
    r1OffsetX: 295,
    r1Y: 94,
    r2OffsetX: 735,
    r2Y: 84,
    nextY: 476,
    nextWidth: 1080,
  });

  // --- Cluster S2-C3 (Pattern C: 일찍 해제하면 낮은 발판, 적절히 해제하면 높은 발판 도착) ---
  const splitLaunchPlat = appendJumpStep(235, 492, 900, false);
  guides.push({
    id: 'mg_s2_split',
    x: splitLaunchPlat.x + splitLaunchPlat.width - 350,
    y: 288,
    title: '해제 타이밍 분기!',
    subtitle: '일찍 놓으면 아래 안전 발판 · 상승 탄력에 놓으면 위 황금 눈꽃 발판!',
  });
  {
    const fromX = splitLaunchPlat.x + splitLaunchPlat.width;
    const splitRing = addRing(fromX + 290, 86);

    // Lower Safe Platform (early release dx ~65..95 stays below y=416 and lands cleanly on y=516!)
    const lowerPlat = addPlat(fromX + 645, 516, 1180);
    addLineSnowflakes(snowflakes, `ms_split_low_${++sIdx}`, lowerPlat.x + 190, 468, 118, 5);

    // Upper Reward Platform (proper upswing release dx ~145..190 rises to y~350..375 and lands on y=416!)
    const upperPlat = addPlat(fromX + 625, 416, 780);
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: upperPlat.x + 150,
      y: upperPlat.y - 58,
      kind: 'golden',
      collected: false,
    });
    addLineSnowflakes(snowflakes, `ms_split_hi_${++sIdx}`, upperPlat.x + 300, upperPlat.y - 52, 118, 2);
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: upperPlat.x + 580,
      y: upperPlat.y - 58,
      kind: 'golden',
      collected: false,
    });

    // Shared Rest Terrace where both lower and upper routes reunite smoothly
    const reuniteX = lowerPlat.x + lowerPlat.width + 205;
    const reunitePlat = addPlat(reuniteX, 490, 1080);
    populatePlatformRunSnowflakes(reunitePlat, 3);

    challenges.push({
      id: 'S2-C3',
      stageId: 2,
      kind: 'split-release',
      label: '2구간 패턴 C (해제 시점별 상·하단 분기 발판)',
      startPlatId: splitLaunchPlat.id,
      startX: Math.max(splitLaunchPlat.x + 60, fromX - 420),
      chasmStartX: fromX,
      endX: reuniteX,
      ringIds: [splitRing.id],
      minRequiredRings: 1,
      lowerPlatId: lowerPlat.id,
      upperPlatId: upperPlat.id,
    });

    currentPlat = reunitePlat;
  }

  // --- Cluster S2-C4 (Pattern D: 짧은 중간 발판 착지 후 다시 점프와 와이어 연결) ---
  {
    const pierLaunchPlat = currentPlat;
    const fromX = pierLaunchPlat.x + pierLaunchPlat.width;
    const r1 = addRing(fromX + 295, 92);
    // Short 300px mid-chasm touch-and-go stone pier (~0.55s contact window!)
    const shortPier = addPlat(fromX + 695, 478, 300);
    addArcSnowflakes(
      snowflakes,
      `ms_pier1_${++sIdx}`,
      r1.x - 90,
      r1.x + 130,
      406,
      -28,
      3
    );
    pushSpacedSnowflake(snowflakes, {
      id: `ms_pier_mid_${++sIdx}`,
      x: shortPier.x + 150,
      y: shortPier.y - 54,
      kind: 'normal',
      collected: false,
    });

    const pierEndX = shortPier.x + shortPier.width;
    const r2 = addRing(pierEndX + 295, 86);
    const afterPierRest = addPlat(pierEndX + 705, 468, 1080);
    addArcSnowflakes(
      snowflakes,
      `ms_pier2_${++sIdx}`,
      r2.x - 90,
      r2.x + 135,
      398,
      -28,
      3
    );
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: afterPierRest.x - 88,
      y: afterPierRest.y - 204,
      kind: 'golden',
      collected: false,
    });
    populatePlatformRunSnowflakes(afterPierRest, 3);

    challenges.push({
      id: 'S2-C4',
      stageId: 2,
      kind: 'short-pier-combo',
      label: '2구간 패턴 D (와이어 → 짧은 중간 발판 착지 → 점프·와이어)',
      startPlatId: pierLaunchPlat.id,
      startX: Math.max(pierLaunchPlat.x + 60, fromX - 420),
      chasmStartX: fromX,
      endX: afterPierRest.x,
      ringIds: [r1.id, r2.id],
      minRequiredRings: 1,
    });

    currentPlat = afterPierRest;
  }

  // --- Cluster S2-C5 (Pattern B #2: 고리 A→B 언덕 상승 재연결 필수 #2) ---
  appendJumpStep(235, 494, 900, true);
  const { landPlat: stage3EntryPlat } = appendMandatoryDoubleWire({
    id: 'S2-C5',
    stageId: 2,
    label: '2구간 패턴 B #2 (언덕 상승 A→B 고리 재연결)',
    chasmWidth: 1165,
    r1OffsetX: 295,
    r1Y: 98,
    r2OffsetX: 745,
    r2Y: 76, // 22px higher second ring!
    nextY: 454, // -40px uphill landing onto Stage 3 summit entry!
    nextWidth: 1380,
  });

  const actualStage2EndX = stage3EntryPlat.x + 120;

  // ===========================================================================
  // STAGE 3: 눈꽃광장으로! — 연속 와이어 종합 도전 (64% ~ 100%, ~35s)
  // 4 Major Mandatory Multi-Wire Clusters (including 3 floorless A->B->C chains!),
  // narrower Stage 3 landings (480~580px), and a wide safe 2,600px Final Arrival Plaza!
  // ===========================================================================
  guides.push({
    id: 'mg_s3_intro',
    x: stage3EntryPlat.x + 560,
    y: 278,
    title: '3구간 · 연속 와이어 종합 도전',
    subtitle: '좁아진 옥상과 고리 A→B→C 3연속 공중 스윙을 넘어 눈꽃광장으로!',
  });

  // --- Cluster S3-C1: Mandatory Floorless A->B->C Triple-Wire #1 (Rising & Diving Cascade) ---
  appendJumpStep(250, 478, 580, false);
  appendMandatoryTripleWire({
    id: 'S3-C1',
    stageId: 3,
    label: '3구간 필수 3연속 와이어 #1 (A→B→C 고저 변화 공중 돌파)',
    chasmWidth: 1590,
    r1OffsetX: 295,
    r1Y: 108,
    r2OffsetX: 725, // 430px spacing, +32px higher!
    r2Y: 76,
    r3OffsetX: 1180, // 455px spacing, -20px lower!
    r3Y: 96,
    nextY: 466,
    nextWidth: 540, // Narrower Stage 3 landing platform!
  });

  appendJumpStep(255, 488, 540, false);
  appendJumpStep(260, 472, 580, true);

  // --- Cluster S3-C2: Floorless A->B Reconnect -> Short 305px Pier -> Split-Deck Uphill Wire ---
  {
    const c2LaunchPlat = currentPlat;
    const c2StartX = Math.max(c2LaunchPlat.x + 50, c2LaunchPlat.x + c2LaunchPlat.width - 400);
    const c2ChasmStartX = c2LaunchPlat.x + c2LaunchPlat.width;

    // Part 1: Floorless A->B Double-Wire onto short 305px stone pier
    const { rings: abRings, landPlat: relayPier } = appendMandatoryDoubleWire({
      id: 'S3-C2-AB',
      stageId: 3,
      label: '3구간 복합 도전 #2-A (A→B 재연결 후 305px 징검다리 착지)',
      chasmWidth: 1165,
      r1OffsetX: 295,
      r1Y: 88,
      r2OffsetX: 745,
      r2Y: 96,
      nextY: 484,
      nextWidth: 305, // Crisp 305px mid-abyss relay pier!
      recordChallenge: true,
    });

    // Part 2: Immediate jump off 305px pier into Wire C with Safe Lower vs Golden Upper Deck
    const pierEnd = relayPier.x + relayPier.width;
    const rC = addRing(pierEnd + 300, 82);
    const safeMainDeck = addPlat(pierEnd + 715, 480, 860);
    addLineSnowflakes(snowflakes, `ms_s3_safe_${++sIdx}`, safeMainDeck.x + 170, 428, 118, 4);

    // Optional riskier high Golden Deck for late-upswing masters (auto-reunites onto safeMainDeck/next hop!)
    const highGoldDeck = addPlat(pierEnd + 790, 396, 420);
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: highGoldDeck.x + 120,
      y: highGoldDeck.y - 56,
      kind: 'golden',
      collected: false,
    });
    pushSpacedSnowflake(snowflakes, {
      id: `ms_gold_${++sIdx}`,
      x: highGoldDeck.x + 295,
      y: highGoldDeck.y - 56,
      kind: 'golden',
      collected: false,
    });

    const afterC2Plat = addPlat(safeMainDeck.x + safeMainDeck.width + 250, 484, 600);
    populatePlatformRunSnowflakes(afterC2Plat, 2);

    challenges.push({
      id: 'S3-C2',
      stageId: 3,
      kind: 'short-pier-combo',
      label: '3구간 복합 도전 #2 (A→B 재연결 → 짧은 발판 → 상·하단 분기 와이어)',
      startPlatId: c2LaunchPlat.id,
      startX: c2StartX,
      chasmStartX: c2ChasmStartX,
      endX: safeMainDeck.x,
      ringIds: [abRings[0].id, abRings[1].id, rC.id],
      minRequiredRings: 2,
      lowerPlatId: safeMainDeck.id,
      upperPlatId: highGoldDeck.id,
    });

    currentPlat = afterC2Plat;
  }

  // --- Cluster S3-C3: Mandatory Floorless A->B->C Triple-Wire #2 (Long Dive & High Cliff Vault) ---
  appendMandatoryTripleWire({
    id: 'S3-C3',
    stageId: 3,
    label: '3구간 필수 3연속 와이어 #2 (A→B→C 급강하·급상승 파도 돌파)',
    chasmWidth: 1615,
    r1OffsetX: 295,
    r1Y: 78, // High entry ring
    r2OffsetX: 750, // 455px spacing, drops 34px lower!
    r2Y: 112,
    r3OffsetX: 1190, // 440px spacing, climbs 38px higher!
    r3Y: 74,
    nextY: 452,
    nextWidth: 520, // Crisp 520px cliff terrace
  });

  // Rhythmic high-speed Stage 3 bridge keeping full run squarely inside 90~120s
  appendJumpStep(255, 476, 560, false);
  appendMandatorySingleWire({
    id: 'S3-BRIDGE',
    stageId: 3,
    label: '3구간 고속 단거리 테라스 스윙',
    chasmWidth: 740,
    ringOffsetX: 310,
    ringY: 88,
    nextY: 488,
    nextWidth: 580,
  });
  appendJumpStep(255, 468, 560, true);
  appendJumpStep(255, 486, 580, false);

  // --- Cluster S3-C4: Grand Finale Comprehensive Pattern (종합 패턴 -> 2,600px Snowflower Plaza!) ---
  guides.push({
    id: 'mg_s3_finale',
    x: currentPlat.x + 250,
    y: 274,
    title: '최종 관문 · 눈꽃광장 앞!',
    subtitle: '와이어 + 짧은 중계 발판 + A→B→C 3연속 스윙으로 눈꽃광장에 입성하세요!',
  });

  {
    const finaleLaunchPlat = appendJumpStep(255, 470, 540, false);
    const finaleStartX = finaleLaunchPlat.x + 60;
    const finaleChasm1X = finaleLaunchPlat.x + finaleLaunchPlat.width;

    // Step 1 of Comprehensive Finale: Single Wire across 720px onto a short 295px relay pier!
    const relayRing = addRing(finaleChasm1X + 300, 88);
    const finalePier = addPlat(finaleChasm1X + 720, 482, 295);
    addArcSnowflakes(
      snowflakes,
      `ms_fin_r0_${++sIdx}`,
      relayRing.x - 85,
      relayRing.x + 125,
      402,
      -26,
      3
    );
    pushSpacedSnowflake(snowflakes, {
      id: `ms_fin_pier_${++sIdx}`,
      x: finalePier.x + 145,
      y: finalePier.y - 54,
      kind: 'normal',
      collected: false,
    });

    currentPlat = finalePier;

    // Step 2 of Comprehensive Finale: Floorless A->B->C Triple-Wire directly onto the 2,600px Final Arrival Plaza!
    const { rings: abcRings, landPlat: arrivalPlaza } = appendMandatoryTripleWire({
      id: 'S3-C4-ABC',
      stageId: 3,
      label: '3구간 최종 관문 3연속 와이어 (A→B→C 피날레)',
      chasmWidth: 1605,
      r1OffsetX: 295,
      r1Y: 104,
      r2OffsetX: 730,
      r2Y: 76,
      r3OffsetX: 1185,
      r3Y: 90,
      nextY: baseFloorY, // 492
      nextWidth: 2600, // Generous, 100% safe Snowflower Plaza arrival platform!
      isArrival: true,
      recordChallenge: true,
    });

    // Celebratory welcome arc right above the entrance of Snowflower Plaza
    addArcSnowflakes(
      snowflakes,
      `ms_plaza_welcome_${++sIdx}`,
      arrivalPlaza.x + 80,
      arrivalPlaza.x + 420,
      baseFloorY - 56,
      78,
      4,
      [2]
    );

    challenges.push({
      id: 'S3-C4',
      stageId: 3,
      kind: 'comprehensive-finale',
      label: '3구간 최종 종합 패턴 (단일 와이어 → 285px 중계 발판 → A→B→C 3연속 와이어 → 눈꽃광장)',
      startPlatId: finaleLaunchPlat.id,
      startX: finaleStartX,
      chasmStartX: finaleChasm1X,
      endX: arrivalPlaza.x,
      ringIds: [relayRing.id, abcRings[0].id, abcRings[1].id, abcRings[2].id],
      minRequiredRings: 3,
    });

    return {
      mode: 'main',
      startX: COURSE_BOUNDS.startX,
      startY: baseFloorY,
      stage1EndX: actualStage1EndX,
      stage2EndX: actualStage2EndX,
      arrivalStartX: arrivalPlaza.x,
      totalEndX: arrivalPlaza.x + arrivalPlaza.width,
      platforms,
      rings,
      snowflakes,
      guides,
      challenges,
    };
  }
}
