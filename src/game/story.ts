import { ASSET_PATHS } from './config';
import { SnowflakeDef } from './types';

export interface IntroLetterCardData {
  lines: readonly [string, string];
  signature: string;
}

export interface IntroSlideDef {
  index: 0 | 1 | 2;
  pageLabel: '1/3' | '2/3' | '3/3';
  imageSrc: string;
  imageAlt: string;
  lines: readonly string[];
  subCaption?: string;
  letterCard?: IntroLetterCardData;
  guideHint?: string;
  nextButtonLabel: string;
  isFinalSlide: boolean;
}

export interface EndingStoryStepDef {
  stepIndex: 0 | 1 | 2 | 3;
  sceneNumber: 1 | 2;
  imageSrc: string;
  imageAlt: string;
  lines: readonly string[];
  finaleTitle?: string;
  finaleSubtitle?: string;
  playfulNote?: string;
  bonusLine?: string;
  buttonLabel: string;
  isFinalStep: boolean;
}

export const STAGE1_STORY_CALLOUT = '먹밥이가 남긴 눈꽃을 따라가자!';

export const SNOWFLOWER_BADGE_NAME = '눈꽃 배달 완료';

export const INTRO_SLIDES: readonly IntroSlideDef[] = [
  {
    index: 0,
    pageLabel: '1/3',
    imageSrc: ASSET_PATHS.intro01,
    imageAlt: '과제 더미 앞에서 지친 송이와 창밖에서 눈꽃 편지를 건네는 고양이 먹밥이',
    lines: [
      '“과제 하나를 끝내면, 또 하나가 생겼다.”',
      '“오늘도 송이는 학교 밖으로 한 발짝도 나가지 못했다.”',
    ],
    subCaption: '“그때, 창문을 두드리는 소리가 났다.”',
    nextButtonLabel: '다음',
    isFinalSlide: false,
  },
  {
    index: 1,
    pageLabel: '2/3',
    imageSrc: ASSET_PATHS.intro02,
    imageAlt: '먹밥이가 가져온 초대장을 펼쳐 보는 송이와 눈꽃광장 쪽을 가리키는 먹밥이',
    lines: ['“평소 밥을 챙겨주던 먹밥이가 초대장을 물고 왔다.”'],
    letterCard: {
      lines: ['“눈꽃을 따라 눈꽃광장으로 와.', '오늘 밤, 네 자리를 비워 뒀어.”'],
      signature: '— 발바닥 도장',
    },
    nextButtonLabel: '다음',
    isFinalSlide: false,
  },
  {
    index: 2,
    pageLabel: '3/3',
    imageSrc: ASSET_PATHS.intro03,
    imageAlt: '닌자 복면을 올리고 먹밥이와 눈꽃 길을 따라 밤 캠퍼스로 뛰어오르는 송이',
    lines: [
      '“누가 기다리는 걸까?”',
      '“송이는 복면을 올리고, 눈꽃을 향해 뛰었다.”',
    ],
    guideHint: '점프하고, 와이어를 걸어 눈꽃광장까지!',
    nextButtonLabel: '탈주 시작',
    isFinalSlide: true,
  },
] as const;

export const ENDING_STORY_STEPS: readonly EndingStoryStepDef[] = [
  {
    stepIndex: 0,
    sceneNumber: 1,
    imageSrc: ASSET_PATHS.ending01,
    imageAlt: '눈꽃광장에서 송이를 맞이하며 푹신한 방석과 담요, 따뜻한 차를 가리키는 먹밥이와 고양이들',
    lines: [
      '“광장에는 송이를 기다리는 작은 자리가 있었다.”',
      '“늘 우리를 챙겨줬잖아.”',
      '“오늘은 네가 챙김받을 차례야.”',
    ],
    buttonLabel: '다음',
    isFinalStep: false,
  },
  {
    stepIndex: 1,
    sceneNumber: 1,
    imageSrc: ASSET_PATHS.ending01,
    imageAlt: '초대장을 들고 감동한 송이와 눈꽃광장의 따뜻한 쉼터',
    lines: ['“비워 둔 자리는, 처음부터 송이의 자리였다.”'],
    buttonLabel: '다음',
    isFinalStep: false,
  },
  {
    stepIndex: 2,
    sceneNumber: 2,
    imageSrc: ASSET_PATHS.ending02,
    imageAlt: '눈꽃광장 방석 위에서 체크 담요를 덮고 먹밥이·고양이들과 나란히 잠든 송이',
    lines: [
      '“송이는 처음으로, 아무것도 하지 않는 임무를 받았다.”',
      '“탈주한 곳은 학교 밖이 아니라,”',
      '“잠깐 쉬어도 괜찮은 밤이었다.”',
    ],
    buttonLabel: '다음',
    isFinalStep: false,
  },
  {
    stepIndex: 3,
    sceneNumber: 2,
    imageSrc: ASSET_PATHS.ending02,
    imageAlt: '별빛과 눈꽃 불빛 아래 편안하게 쉬고 있는 송이와 캠퍼스 고양이들',
    lines: [],
    finaleTitle: '오늘의 임무: 푹 쉬기',
    finaleSubtitle: '탈주닌자송이 — THE END',
    playfulNote: '먹밥이의 작전: 송이 재우기. 성공.',
    bonusLine: '“모아 온 눈꽃 덕분에, 광장의 불빛은 아침까지 꺼지지 않았다.”',
    buttonLabel: '결과 보기',
    isFinalStep: true,
  },
] as const;

export interface UniqueSnowflakeStats {
  totalCourseSnowflakes: number;
  collectedUniqueSnowflakes: number;
  normalCollected: number;
  goldenCollected: number;
  collectionRatio: number;
  collectionPercent: number;
  isBonusUnlocked: boolean;
}

/**
 * Computes snowflake collection rate strictly over the unique snowflakes placed in the course.
 * - Counts both Normal and Golden snowflakes as 1 item each.
 * - Deduplicates by `id` so duplicate references or camera-pool respawns can never inflate counts.
 * - Uses exact integer math (`collected * 5 >= total * 4`) for the 80% bonus threshold,
 *   and floors percentages below 80% so e.g. 79.6% displays as 79% (never misleadingly as 80%).
 */
export function computeUniqueSnowflakeStats(
  courseSnowflakes: ReadonlyArray<SnowflakeDef>
): UniqueSnowflakeStats {
  const seenIds = new Set<string>();
  let totalUnique = 0;
  let collectedUnique = 0;
  let normalCollected = 0;
  let goldenCollected = 0;

  for (let i = 0; i < courseSnowflakes.length; i++) {
    const sf = courseSnowflakes[i];
    if (seenIds.has(sf.id)) continue;
    seenIds.add(sf.id);
    totalUnique++;
    if (sf.collected) {
      collectedUnique++;
      if (sf.kind === 'golden') {
        goldenCollected++;
      } else {
        normalCollected++;
      }
    }
  }

  const collectionRatio = totalUnique > 0 ? collectedUnique / totalUnique : 0;
  const isBonusUnlocked =
    totalUnique > 0 && collectedUnique * 5 >= totalUnique * 4;

  let collectionPercent = 0;
  if (totalUnique > 0) {
    if (!isBonusUnlocked) {
      collectionPercent = Math.min(79, Math.floor(collectionRatio * 100 + 1e-9));
    } else if (collectedUnique === totalUnique) {
      collectionPercent = 100;
    } else {
      collectionPercent = Math.min(99, Math.round(collectionRatio * 100));
    }
  }

  return {
    totalCourseSnowflakes: totalUnique,
    collectedUniqueSnowflakes: collectedUnique,
    normalCollected,
    goldenCollected,
    collectionRatio,
    collectionPercent,
    isBonusUnlocked,
  };
}

export function advanceIntroStep(currentIndex: number): {
  nextIndex: number;
  shouldStartGame: boolean;
} {
  const clamped = Math.max(0, Math.min(INTRO_SLIDES.length - 1, currentIndex));
  if (clamped >= INTRO_SLIDES.length - 1) {
    return { nextIndex: clamped, shouldStartGame: true };
  }
  return { nextIndex: clamped + 1, shouldStartGame: false };
}

export function rewindIntroStep(currentIndex: number): number {
  const clamped = Math.max(0, Math.min(INTRO_SLIDES.length - 1, currentIndex));
  return Math.max(0, clamped - 1);
}

export function advanceEndingStoryStep(currentIndex: number): {
  nextIndex: number;
  shouldShowResult: boolean;
} {
  const clamped = Math.max(
    0,
    Math.min(ENDING_STORY_STEPS.length - 1, currentIndex)
  );
  if (clamped >= ENDING_STORY_STEPS.length - 1) {
    return { nextIndex: clamped, shouldShowResult: true };
  }
  return { nextIndex: clamped + 1, shouldShowResult: false };
}
