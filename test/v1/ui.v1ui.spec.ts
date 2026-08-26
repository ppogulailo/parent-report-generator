import { expect, test, type Page } from '@playwright/test';
import { resetMock, setMode } from './harness';

/**
 * The Version 1.0 flow in a browser: a parent answering 24 questions, one
 * concern domain at a time, and receiving a plan.
 *
 * The API suite proves the contract; this proves a person can get through it.
 * Both matter, and neither substitutes for the other — a working endpoint behind
 * a form nobody can finish is not a product.
 *
 * The selectors are the existing design's own class names (`qcard`, `opt`,
 * `results`, `level-card`, `scard`), deliberately: if the V1 flow ever drifts
 * back onto bespoke markup, these fail.
 */

const NEXT = 'Next';

/**
 * Buttons are matched exactly.
 *
 * Playwright matches an accessible name as a substring by default, and the Next
 * dev server injects a button called "Open Next.js Dev Tools" — which matches
 * "Next" and made every step click a strict-mode violation. An artifact of
 * testing against `next dev`, not something a parent would ever hit, but it has
 * to be excluded or the suite cannot walk the form.
 */
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });

/**
 * The step controls appear twice — above and below the questions — so a locator
 * has to say which. Tests use the bottom one, which sits next to the hint that
 * explains why Next is disabled.
 */
const nav = (page: Page, name: string) => button(page, name).last();

const submitButton = (page: Page) => nav(page, 'Generate Action Plan');

/** Answers every card on the current step; returns how many it answered. */
async function answerStep(page: Page, index: number): Promise<number> {
  const cards = page.locator('#questionnaire .qcard');
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    await cards.nth(i).locator('.opt input').nth(index).check();
  }
  return count;
}

/** Walks every question step, answering as it goes, stopping on the final step
 *  where the generate button lives. */
async function answerAll(page: Page, index: number, next = NEXT) {
  let answered = 0;
  for (let guard = 0; guard < 12; guard++) {
    const advance = nav(page, next);
    if ((await advance.count()) === 0) break;
    answered += await answerStep(page, index);
    await advance.click();
  }
  expect(answered, 'all 24 questions should have been answered').toBe(24);
}

// The mock holds one mode at a time, so a test that fails before resetting it
// would leave every later test talking to a misbehaving model — which reads as a
// cascade of unrelated failures.
test.beforeEach(async ({ request }) => {
  await resetMock(request);
});

/** Dismisses a resume banner left by an earlier test, so each starts clean. */
async function freshStart(page: Page, label = 'Start fresh') {
  const fresh = button(page, label).last();
  if (await fresh.isVisible().catch(() => false)) await fresh.click();
}

test('the questionnaire shows one concern domain at a time', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);

  await expect(page.locator('.brandbar')).toBeVisible();
  await expect(page.locator('.scale-legend')).toBeVisible();
  await expect(page.locator('.progress-track')).toBeVisible();

  // One section header, a step counter, and only that section's questions.
  await expect(page.locator('.qgroup-head')).toHaveCount(1);
  await expect(page.locator('.qgroup-title')).toContainText(
    'Immediate Safety & Urgency',
  );
  await expect(page.locator('.step-count')).toContainText('Step 1 of');

  const shown = await page.locator('#questionnaire .qcard').count();
  expect(shown).toBeGreaterThan(0);
  expect(shown, 'a step should not be the whole questionnaire').toBeLessThan(
    24,
  );

  // The optional questions stay out of the way until the end.
  await expect(page.locator('.crisis-textarea')).toHaveCount(0);
});

test('every question number stays unique across the whole walk', async ({
  page,
}) => {
  // The approved methodology overlaps — q18 and q22 each belong to two domains
  // — so numbering has to stay unique across steps or a parent sees the same
  // number twice and no 24th.
  await page.goto('/en/v1');
  await freshStart(page);

  const numbers: string[] = [];
  for (let guard = 0; guard < 12; guard++) {
    const next = nav(page, NEXT);
    if ((await next.count()) === 0) break;
    numbers.push(
      ...(await page.locator('#questionnaire .qbadge').allInnerTexts()).map(
        (text) => text.trim(),
      ),
    );
    await answerStep(page, 0);
    await next.click();
  }

  expect(numbers).toHaveLength(24);
  expect(new Set(numbers).size, 'duplicate question numbers').toBe(24);
});

test('Next refuses to advance until the section is complete, and says why', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);

  const next = nav(page, NEXT);

  // Disabled, with the reason already on screen — so a parent never presses a
  // dead button wondering why nothing happened. An earlier version used
  // aria-disabled to keep it pressable, which told assistive technology the
  // button was disabled anyway and produced the same dead end.
  await expect(next).toBeDisabled();
  await expect(
    page.locator('.generate-hint', { hasText: 'Answer every question' }),
  ).toBeVisible();
  await expect(page.locator('.step-count')).toContainText('Step 1 of');

  await answerStep(page, 0);
  await expect(next).toBeEnabled();
  await expect(
    page.locator('.generate-hint', { hasText: 'Answer every question' }),
  ).toHaveCount(0);
  await next.click();
  await expect(page.locator('.step-count')).toContainText('Step 2 of');
});

test('the step controls appear above the questions as well as below', async ({
  page,
}) => {
  // On a long section the controls were only reachable by scrolling to the
  // bottom, which meant scrolling back up to read the heading again.
  await page.goto('/en/v1');
  await freshStart(page);

  await expect(button(page, NEXT)).toHaveCount(2);
  await expect(button(page, 'Back')).toHaveCount(2);

  // The top one is above the first question; the bottom one is below the last.
  const cards = page.locator('#questionnaire .qcard');
  const topNav = await button(page, NEXT).first().boundingBox();
  const firstCard = await cards.first().boundingBox();
  const bottomNav = await button(page, NEXT).last().boundingBox();
  const lastCard = await cards.last().boundingBox();
  expect(topNav!.y).toBeLessThan(firstCard!.y);
  expect(bottomNav!.y).toBeGreaterThan(lastCard!.y);

  // And the top one advances, so it is a control rather than decoration.
  await answerStep(page, 0);
  await button(page, NEXT).first().click();
  await expect(page.locator('.step-count')).toContainText('Step 2 of');
});

test('Back returns to the previous section with the answers intact', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);

  const back = nav(page, 'Back');
  await expect(back).toBeDisabled();

  const firstTitle = await page.locator('.qgroup-title').innerText();
  await answerStep(page, 2);
  await nav(page, NEXT).click();
  await expect(page.locator('.step-count')).toContainText('Step 2 of');

  await back.click();
  await expect(page.locator('.qgroup-title')).toHaveText(firstTitle);
  const cards = page.locator('#questionnaire .qcard');
  await expect(cards.first()).toHaveClass(/answered/);
  await expect(cards.first().locator('.opt input').nth(2)).toBeChecked();
});

test('the last step holds the urgent field and the generate button', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 1);

  await expect(page.locator('.qgroup-title')).toContainText('Before your plan');
  // One optional question now, not two: the treatment-status gate was removed
  // by founder decision on 2026-08-25, and the copy must say so.
  await expect(page.locator('.qgroup-desc').first()).toContainText(
    'One optional question',
  );
  await expect(page.locator('input[name="treatment-status"]')).toHaveCount(0);
  await expect(page.locator('.crisis-textarea')).toBeVisible();
  await expect(submitButton(page)).toBeEnabled();
  await expect(button(page, NEXT)).toHaveCount(0);
});

test("Next lands the new section's first question at the top of the screen", async ({
  page,
}) => {
  // Pressing Next used to scroll to wherever the OLD step's content happened to
  // be, because the click handler ran before React had rendered the new cards.
  await page.goto('/en/v1');
  await freshStart(page);

  await answerStep(page, 1);
  await nav(page, NEXT).click();
  await expect(page.locator('.step-count')).toContainText('Step 2 of');

  // `.qcard` carries scroll-margin-top: 120px, which is what clears the sticky
  // brandbar. Anything much larger means the parent has to scroll to find the
  // question they were sent to.
  await expect
    .poll(
      async () =>
        Math.round(
          (await page.locator('#questionnaire .qcard').first().boundingBox())
            ?.y ?? 9999,
        ),
      { timeout: 5000 },
    )
    .toBeLessThan(200);

  // And the brandbar is still the only thing above it.
  const bar = await page.locator('.brandbar').boundingBox();
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(130);
});

test('no draft notice now the content is founder-approved', async ({
  page,
}) => {
  // The notice reads the capabilities endpoint at runtime, so Dave's approval
  // (2026-08-25) removes it with no frontend rebuild. Wait for the form itself
  // first so the absence is an answer rather than a page still loading.
  await page.goto('/en/v1');
  await expect(page.locator('.scale-legend')).toBeVisible();
  await expect(
    page.locator('.safety-note', { hasText: 'under review' }),
  ).toHaveCount(0);
});

test('answering a question marks its card, and the progress bar moves', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);
  const first = page.locator('#questionnaire .qcard').first();
  await expect(first).not.toHaveClass(/answered/);
  await first.locator('.opt input').first().check();
  await expect(first).toHaveClass(/answered/);
  await expect(page.locator('.progress-label')).toContainText('1');
});

// ------------------------------------------------------------ saved progress

test('a saved place is offered back, and Continue lands on the first gap', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);

  const answered = await answerStep(page, 0);
  await nav(page, NEXT).click();
  await expect(page.locator('.step-count')).toContainText('Step 2 of');

  await page.reload();

  const banner = page.locator('#resume');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('You have answers saved');
  await expect(banner).toContainText(`You answered ${answered} of 24`);
  // The claim in that sentence has to stay true.
  await expect(banner).toContainText('Nothing was sent anywhere');

  await banner.getByRole('button', { name: 'Continue', exact: true }).click();

  // Straight to the first section with a gap, not back to the beginning.
  await expect(page.locator('.step-count')).toContainText('Step 2 of');
  await expect(page.locator('.progress-label')).toContainText(String(answered));
});

test('Start fresh discards the saved answers for good', async ({ page }) => {
  await page.goto('/en/v1');
  await freshStart(page);
  await answerStep(page, 0);
  await page.reload();

  await expect(page.locator('#resume')).toBeVisible();
  await button(page, 'Start fresh').last().click();

  await expect(page.locator('#resume')).toHaveCount(0);
  await expect(page.locator('.progress-label')).toContainText('0');
  await expect(page.locator('.step-count')).toContainText('Step 1 of');

  // Gone, not merely hidden: a reload must not offer them again.
  await page.reload();
  await expect(page.locator('#resume')).toHaveCount(0);
});

test('the urgent note is never saved, though the answers are', async ({
  page,
}) => {
  // The most sensitive thing a parent types here, on what is often a family
  // computer. Losing it on a refresh is an inconvenience; restoring it into a
  // visible textarea for whoever opens the page next is a harm.
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 3);

  await page
    .locator('.crisis-textarea')
    .fill('He took something last night and will not say what.');

  const stored = await page.evaluate(() =>
    window.localStorage.getItem('mi-v1-progress'),
  );
  expect(stored, 'the answers should be saved').toContain('q01');
  expect(stored, 'the urgent note must not be').not.toContain('took something');
});

test('a generated plan clears the saved answers', async ({ page }) => {
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 0);
  await submitButton(page).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });

  // The plan exists, so the saved answers have done their job and should not sit
  // in the browser afterwards.
  expect(
    await page.evaluate(() => window.localStorage.getItem('mi-v1-progress')),
  ).toBeNull();
});

// ------------------------------------------------------------------- the plan

test('a parent can complete the questionnaire and read a plan', async ({
  page,
  request,
}) => {
  await resetMock(request);
  await page.goto('/en/v1');
  await freshStart(page);

  // Option index 3 is the most concerning answer to every question, which lands
  // in the Serious register and exercises the fullest plan.
  await answerAll(page, 3);
  await submitButton(page).click();

  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.status-heading')).toContainText(
    'Your plan is ready.',
  );

  // Severity as a label and a sentence, in the existing level card — never as a
  // score.
  await expect(page.locator('.level-tag')).toContainText('Serious');
  await expect(page.locator('.level-overline')).toContainText('Overall level');
  await expect(page.locator('.results')).not.toContainText('2.75');

  await expect(page.locator('.domain-card')).toHaveCount(5);
  await expect(page.locator('.top-domain')).toHaveCount(3);
  await expect(page.locator('.sections .scard').first()).toBeVisible();

  // Priority areas carry the matrix's own name alongside the model's headline.
  await expect(page.locator('.priority').first()).toBeVisible();
  await expect(page.locator('.priority-area').first()).not.toBeEmpty();

  // Workshops render with their category and, until ASAP supplies URLs, the note
  // explaining why they are not links.
  await expect(page.locator('.workshop').first()).toBeVisible();
  await expect(
    page.locator('.workshops-note', { hasText: 'coming soon' }),
  ).toBeVisible();

  // The Universal Guiding Principle is platform copy and must appear verbatim.
  await expect(page.locator('.results')).toContainText(
    'match the level of risk',
  );
});

test('the results screen arrives before the plan is written', async ({
  page,
  request,
}) => {
  // The point of streaming. Everything the matrix decided needs no model, so a
  // parent should be reading their scores while the prose is still arriving —
  // not watching a spinner on the form for a minute.
  await setMode(request, 'slow');
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 3);

  await submitButton(page).click();

  // Off the form and onto the results almost at once.
  await expect(page.locator('.results')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#questionnaire')).toHaveCount(0);

  // And it is not an empty shell: the decision is all there already.
  await expect(page.locator('.level-tag')).toContainText('Serious');
  await expect(page.locator('.domain-card')).toHaveCount(5);
  await expect(page.locator('.top-domain')).toHaveCount(3);
  await expect(page.locator('.workshop-title').first()).not.toBeEmpty();
  // Platform copy is the platform's, so it is whole from the first moment.
  await expect(page.locator('.results')).toContainText(
    'match the level of risk',
  );

  // Still being written: the status says so, and Print is not offered yet.
  await expect(page.locator('.status-card.working')).toBeVisible();
  await expect(button(page, 'Save / Print')).toHaveCount(0);
  // At least one section is still waiting for its prose.
  await expect(page.locator('.section-placeholder').first()).toBeVisible();

  // Then it finishes on its own.
  await expect(page.locator('.status-card.done')).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.status-heading')).toContainText(
    'Your plan is ready.',
  );
  await expect(button(page, 'Save / Print')).toBeVisible();
  await expect(page.locator('.section-placeholder')).toHaveCount(0);

  await resetMock(request);
});

test('a domain score bar has real height, and expands to its description', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 0);
  await submitButton(page).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });

  const card = page.locator('.domain-card').first();
  await expect(card).not.toHaveClass(/open/);

  // 6px on a div; as a span it rendered as nothing and the card looked like a
  // plain row.
  expect(
    (await card.locator('.domain-card-track').boundingBox())?.height ?? 0,
  ).toBeGreaterThan(2);
  expect(
    (await card.locator('.domain-card-fill').boundingBox())?.width ?? 0,
  ).toBeGreaterThan(2);

  await card.locator('.domain-card-btn').click();
  await expect(card).toHaveClass(/open/);
  await expect(card.locator('.domain-card-desc')).not.toBeEmpty();
});

test('the plan can be printed, and the controls are not printed with it', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 0);
  await submitButton(page).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });

  await expect(button(page, 'Save / Print')).toBeVisible();

  // The plan is what a parent takes into a conversation, so the print view drops
  // the chrome and keeps the plan.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.done-actions')).toBeHidden();
  await expect(page.locator('.brandbar')).toBeHidden();
  await expect(page.locator('.results')).toBeVisible();
});

test('a Spanish parent gets a Spanish plan with English workshop titles', async ({
  page,
}) => {
  await page.goto('/es/v1');
  await freshStart(page, 'Empezar de cero');
  await answerAll(page, 3, 'Siguiente');
  await nav(page, 'Generar plan de acción').click();

  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.status-heading')).toContainText(
    'Tu plan está listo.',
  );
  await expect(page.locator('.level-overline')).toContainText('Nivel general');
  // Workshop titles are program resource names and stay in English.
  await expect(page.locator('.workshop-title').first()).toHaveText(
    /^[A-Za-z0-9 ,:'’&+\-–—()]+$/,
  );
});

test('a failed generation shows a message rather than a blank plan', async ({
  page,
  request,
}) => {
  await setMode(request, 'not-json');
  await page.goto('/en/v1');
  await freshStart(page);
  await answerAll(page, 1);
  await submitButton(page).click();

  // Scoped to the error card: Next's own route announcer is also role="alert",
  // so an unscoped role lookup matches two elements and fails strict mode.
  await expect(page.locator('.error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.error')).toContainText('Please try again');
  // Still on the final step with the answers intact, not a half-rendered plan.
  await expect(page.locator('.crisis-textarea')).toBeVisible();
  await expect(page.locator('.results')).toHaveCount(0);

  await resetMock(request);
});

test('every question is a labelled radio group, and the theme toggle works', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await freshStart(page);

  const groups = page.locator('#questionnaire .opts[role="radiogroup"]');
  const count = await groups.count();
  expect(count).toBeGreaterThan(0);
  // Each group is labelled with its own question, so a screen reader announces
  // the question rather than four bare numbers.
  for (let index = 0; index < count; index++) {
    const label = await groups.nth(index).getAttribute('aria-label');
    expect(label?.length ?? 0).toBeGreaterThan(10);
  }

  // Radios within a question share a name, so arrow keys move within the
  // question rather than across the whole form.
  expect(
    await page
      .locator('#questionnaire .qcard')
      .first()
      .locator('input[type=radio]')
      .first()
      .getAttribute('name'),
  ).toBe('q01');

  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
