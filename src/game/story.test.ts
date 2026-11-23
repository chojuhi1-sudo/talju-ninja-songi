import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ASSET_PATHS, resolveAssetPath } from './config';
import { buildMainCourse } from './courses';
import { UnifiedInputController } from './input';
import {
  advanceEndingStoryStep,
  advanceIntroStep,
  computeUniqueSnowflakeStats,
  ENDING_STORY_STEPS,
  INTRO_SLIDES,
  rewindIntroStep,
  SNOWFLOWER_BADGE_NAME,
  STAGE1_STORY_CALLOUT,
} from './story';
import { SnowflakeDef } from './types';

test('all 5 attached intro and ending PNG assets exist on disk and match exact slide order', () => {
  const orderedPaths = [
    ASSET_PATHS.intro01,
    ASSET_PATHS.intro02,
    ASSET_PATHS.intro03,
    ASSET_PATHS.ending01,
    ASSET_PATHS.ending02,
  ];

  for (const relUrl of orderedPaths) {
    const diskPath = path.join(process.cwd(), 'public', relUrl);
    assert.equal(
      fs.existsSync(diskPath),
      true,
      `Expected story asset to exist on disk: ${diskPath}`
    );
    const stat = fs.statSync(diskPath);
    assert.ok(stat.size > 10_000, `Expected non-empty PNG asset: ${diskPath}`);
  }

  assert.equal(INTRO_SLIDES.length, 3);
  assert.equal(INTRO_SLIDES[0].pageLabel, '1/3');
  assert.equal(INTRO_SLIDES[0].imageSrc, ASSET_PATHS.intro01);
  assert.equal(INTRO_SLIDES[0].nextButtonLabel, '다음');

  assert.equal(INTRO_SLIDES[1].pageLabel, '2/3');
  assert.equal(INTRO_SLIDES[1].imageSrc, ASSET_PATHS.intro02);
  assert.ok(INTRO_SLIDES[1].letterCard, 'Slide 2 must include Letter Card UI data');
  assert.equal(INTRO_SLIDES[1].nextButtonLabel, '다음');

  assert.equal(INTRO_SLIDES[2].pageLabel, '3/3');
  assert.equal(INTRO_SLIDES[2].imageSrc, ASSET_PATHS.intro03);
  assert.equal(INTRO_SLIDES[2].nextButtonLabel, '탈주 시작');
  assert.equal(INTRO_SLIDES[2].isFinalSlide, true);

  assert.equal(ENDING_STORY_STEPS.length, 4);
  assert.equal(ENDING_STORY_STEPS[0].imageSrc, ASSET_PATHS.ending01);
  assert.equal(ENDING_STORY_STEPS[1].imageSrc, ASSET_PATHS.ending01);
  assert.equal(ENDING_STORY_STEPS[2].imageSrc, ASSET_PATHS.ending02);
  assert.equal(ENDING_STORY_STEPS[3].imageSrc, ASSET_PATHS.ending02);
  assert.equal(ENDING_STORY_STEPS[3].buttonLabel, '결과 보기');
  assert.equal(STAGE1_STORY_CALLOUT, '먹밥이가 남긴 눈꽃을 따라가자!');
  assert.equal(SNOWFLOWER_BADGE_NAME, '눈꽃 배달 완료');
});

test('intro and ending step transitions advance strictly one step per action', () => {
  const i0 = advanceIntroStep(0);
  assert.deepEqual(i0, { nextIndex: 1, shouldStartGame: false });

  const i1 = advanceIntroStep(i0.nextIndex);
  assert.deepEqual(i1, { nextIndex: 2, shouldStartGame: false });

  const backTo1 = rewindIntroStep(i1.nextIndex);
  assert.equal(backTo1, 1);
  assert.equal(rewindIntroStep(0), 0);

  const i2 = advanceIntroStep(2);
  assert.deepEqual(i2, { nextIndex: 2, shouldStartGame: true });

  const e0 = advanceEndingStoryStep(0);
  assert.deepEqual(e0, { nextIndex: 1, shouldShowResult: false });

  const e1 = advanceEndingStoryStep(1);
  assert.deepEqual(e1, { nextIndex: 2, shouldShowResult: false });

  const e2 = advanceEndingStoryStep(2);
  assert.deepEqual(e2, { nextIndex: 3, shouldShowResult: false });

  const e3 = advanceEndingStoryStep(3);
  assert.deepEqual(e3, { nextIndex: 3, shouldShowResult: true });
});

test('computeUniqueSnowflakeStats handles 0%, <80% boundary, >=80% bonus, and duplicate IDs', () => {
  const course = buildMainCourse();
  assert.ok(course.snowflakes.length >= 80, 'Main course must have unique snowflakes');

  // 1. 0 collected snowflakes -> 0%, no bonus
  const zeroStats = computeUniqueSnowflakeStats(course.snowflakes);
  assert.equal(zeroStats.collectedUniqueSnowflakes, 0);
  assert.equal(zeroStats.collectionPercent, 0);
  assert.equal(zeroStats.isBonusUnlocked, false);

  // 2. 159/200 (79.5%) -> must NOT round up to 80% or unlock bonus!
  const mock200: SnowflakeDef[] = Array.from({ length: 200 }, (_, idx) => ({
    id: `sf_${idx}`,
    x: idx * 50,
    y: 400,
    kind: idx % 5 === 0 ? 'golden' : 'normal',
    collected: idx < 159,
  }));
  const below80 = computeUniqueSnowflakeStats(mock200);
  assert.equal(below80.totalCourseSnowflakes, 200);
  assert.equal(below80.collectedUniqueSnowflakes, 159);
  assert.equal(below80.isBonusUnlocked, false);
  assert.equal(below80.collectionPercent, 79);

  // 3. 160/200 (exact 80.0%) -> unlocks bonus and reports 80%
  mock200[159].collected = true;
  const exact80 = computeUniqueSnowflakeStats(mock200);
  assert.equal(exact80.collectedUniqueSnowflakes, 160);
  assert.equal(exact80.isBonusUnlocked, true);
  assert.equal(exact80.collectionPercent, 80);
  assert.equal(
    exact80.normalCollected + exact80.goldenCollected,
    exact80.collectedUniqueSnowflakes
  );

  // 4. Duplicate IDs in array are ignored so counts never exceed unique course snowflakes
  const withDuplicates = [...mock200, mock200[0], mock200[1], mock200[199]];
  const dedupStats = computeUniqueSnowflakeStats(withDuplicates);
  assert.equal(dedupStats.totalCourseSnowflakes, 200);
  assert.equal(dedupStats.collectedUniqueSnowflakes, 160);
});

test('UnifiedInputController.latchUntilAllReleased blocks held input from leaking into frame 1 jump', () => {
  const input = new UnifiedInputController();
  // Simulate an active source held across scene transition via internal set check
  const internal = input as unknown as {
    pressSource: (id: string) => void;
    releaseSource: (id: string) => void;
  };

  internal.pressSource('ptr:1');
  input.latchUntilAllReleased();

  // Frame 1 while pointer is still held: must NOT trigger jump or wire hold
  const stepWhileHeld = input.consumeStepInput();
  assert.deepEqual(stepWhileHeld, {
    justPressed: false,
    held: false,
    justReleased: false,
  });

  // Release pointer -> clears latch without firing spurious release edge
  internal.releaseSource('ptr:1');
  const stepAfterRelease = input.consumeStepInput();
  assert.deepEqual(stepAfterRelease, {
    justPressed: false,
    held: false,
    justReleased: false,
  });

  // Next fresh press in gameplay works normally!
  internal.pressSource('ptr:2');
  const freshPress = input.consumeStepInput();
  assert.deepEqual(freshPress, {
    justPressed: true,
    held: true,
    justReleased: false,
  });
});

test('resolveAssetPath builds clean GitHub Pages subpath URLs and all 10 ASSET_PATHS exist on disk', () => {
  assert.equal(
    resolveAssetPath('assets/aistudio/image_72d00242.png', '/talju-ninja-songi/'),
    '/talju-ninja-songi/assets/aistudio/image_72d00242.png'
  );
  assert.equal(
    resolveAssetPath('/assets/aistudio/____________-1_d1f251a1.png', '/talju-ninja-songi'),
    '/talju-ninja-songi/assets/aistudio/____________-1_d1f251a1.png'
  );
  assert.equal(
    resolveAssetPath('assets/aistudio/image_9756b79f.png', '/'),
    '/assets/aistudio/image_9756b79f.png'
  );

  for (const [key, relUrl] of Object.entries(ASSET_PATHS)) {
    const diskPath = path.join(process.cwd(), 'public', relUrl);
    assert.equal(
      fs.existsSync(diskPath),
      true,
      `Expected ASSET_PATHS.${key} to exist on disk: ${diskPath}`
    );
  }
});

