import { expect, test, type Page } from '@playwright/test';
import { resetMock, setMode } from './harness';

/**
 * The Version 1.0 flow in a browser: a parent answering 24 questions and
 * receiving a plan.
 *
 * The API suite proves the contract; this proves a person can get through it.
 * Both matter, and neither substitutes for the other — a working endpoint behind
 * a form nobody can submit is not a product.
 *
 * The selectors are the existing design's own class names (`qcard`, `opt`,
 * `results`, `level-card`, `scard`), which is deliberate: if the V1 flow ever
 * drifts back onto bespoke markup, these fail.
 */

/** Answers every scored question by clicking the option at `index`. */
async function answerAll(page: Page, index: number) {
  const cards = page.locator('#questionnaire .qcard');
  const count = await cards.count();
  expect(count, 'the questionnaire should render 24 questions').toBe(24);

  for (let i = 0; i < count; i++) {
    await cards.nth(i).locator('.opt input').nth(index).check();
  }
}

const submitButton = (page: Page) =>
  page.getByRole('button', { name: 'Generate Action Plan' });

test('the questionnaire renders in the existing design, grouped by domain', async ({
  page,
}) => {
  await page.goto('/en/v1');

  await expect(page.locator('.brandbar')).toBeVisible();
  await expect(page.locator('#questionnaire .qcard')).toHaveCount(24);

  // Grouped into the five concern domains, with the same header treatment the
  // live questionnaire uses.
  await expect(page.locator('.qgroup-head')).toHaveCount(5);
  await expect(page.locator('.qgroup-title').first()).not.toBeEmpty();
  await expect(page.locator('.scale-legend')).toBeVisible();
  await expect(page.locator('.progress-track')).toBeVisible();

  // The non-scored gate and the urgent field, both as crisis cards.
  await expect(page.locator('input[name="treatment-status"]')).toHaveCount(5);
  await expect(page.locator('.crisis-textarea')).toBeVisible();
});

test('every question number is unique, though two questions sit in two domains', async ({
  page,
}) => {
  // The approved methodology overlaps: q18 and q22 each belong to two domains.
  // Rendering a question under both would make a 24-question assessment look
  // like 26 and give two cards the same answer.
  await page.goto('/en/v1');

  const badges = await page.locator('#questionnaire .qbadge').allInnerTexts();
  const numbers = badges.map((b) => b.trim());
  expect(numbers).toHaveLength(24);
  expect(new Set(numbers).size, 'duplicate question numbers').toBe(24);
});

test('the Spanish questionnaire renders in Spanish', async ({ page }) => {
  await page.goto('/es/v1');
  await expect(page.locator('#questionnaire .qcard')).toHaveCount(24);
  await expect(page.locator('.qtext').first()).toContainText('¿');
  await expect(
    page.getByRole('button', { name: 'Generar plan de acción' }),
  ).toBeVisible();
});

test('the draft notice is shown while the content is unapproved', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await expect(
    page.locator('.safety-note', { hasText: 'under review' }),
  ).toBeVisible();
});

test('submit stays disabled until every question is answered', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await expect(submitButton(page)).toBeDisabled();

  const cards = page.locator('#questionnaire .qcard');
  for (let i = 0; i < 23; i++) {
    await cards.nth(i).locator('.opt input').first().check();
  }
  await expect(
    page.locator('.generate-hint', { hasText: 'still to answer' }),
  ).toContainText('1 question');
  await expect(submitButton(page)).toBeDisabled();

  await cards.nth(23).locator('.opt input').first().check();
  await expect(submitButton(page)).toBeEnabled();
});

test('answering a question marks its card, and the progress bar moves', async ({
  page,
}) => {
  await page.goto('/en/v1');
  const first = page.locator('#questionnaire .qcard').first();
  await expect(first).not.toHaveClass(/answered/);
  await first.locator('.opt input').first().check();
  await expect(first).toHaveClass(/answered/);
  await expect(page.locator('.progress-label')).toContainText('1');
});

test('a parent can complete the questionnaire and read a plan', async ({
  page,
  request,
}) => {
  await resetMock(request);
  await page.goto('/en/v1');

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

  // The domain scores and top priorities the live report also shows.
  await expect(page.locator('.domain-card')).toHaveCount(5);
  await expect(page.locator('.top-domain')).toHaveCount(3);

  // Plan sections as the existing cards.
  await expect(page.locator('.sections .scard').first()).toBeVisible();

  // Priority areas carry the matrix's own name alongside the model's headline.
  await expect(page.locator('.priority').first()).toBeVisible();
  await expect(page.locator('.priority-area').first()).not.toBeEmpty();

  // Workshops render with their category and, until ASAP supplies URLs, the
  // note explaining why they are not links.
  await expect(page.locator('.workshop').first()).toBeVisible();
  await expect(
    page.locator('.section-placeholder', { hasText: 'coming soon' }),
  ).toBeVisible();

  // The Universal Guiding Principle is platform copy and must appear verbatim.
  await expect(page.locator('.results')).toContainText(
    'match what you are actually seeing',
  );
});

test('a domain score expands when clicked', async ({ page }) => {
  await page.goto('/en/v1');
  await answerAll(page, 0);
  await submitButton(page).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });

  const card = page.locator('.domain-card').first();
  await expect(card).not.toHaveClass(/open/);

  // The score bar must have real height. It is 6px on a div; as a span it
  // rendered as nothing and the card looked like a plain row.
  const track = card.locator('.domain-card-track');
  expect((await track.boundingBox())?.height ?? 0).toBeGreaterThan(2);
  expect(
    (await card.locator('.domain-card-fill').boundingBox())?.width ?? 0,
  ).toBeGreaterThan(2);

  await card.locator('.domain-card-btn').click();
  await expect(card).toHaveClass(/open/);
  // Expanding must reveal what the area means, not open onto nothing.
  await expect(card.locator('.domain-card-desc')).not.toBeEmpty();
});

test('the plan can be printed, and the controls are not printed with it', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await answerAll(page, 0);
  await submitButton(page).click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 60000 });

  await expect(
    page.getByRole('button', { name: 'Save / Print' }),
  ).toBeVisible();

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
  await answerAll(page, 3);
  await page.getByRole('button', { name: 'Generar plan de acción' }).click();

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
  await answerAll(page, 1);
  await submitButton(page).click();

  // Scoped to the error card: Next's own route announcer is also role="alert",
  // so an unscoped role lookup matches two elements and fails strict mode.
  await expect(page.locator('.error[role="alert"]')).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.error')).toContainText('Please try again');
  // Back on the form with the answers intact, rather than a half-rendered plan.
  await expect(page.locator('#questionnaire .qcard')).toHaveCount(24);
  await expect(page.locator('.results')).toHaveCount(0);

  await resetMock(request);
});

test('every question is a labelled radio group, and the theme toggle works', async ({
  page,
}) => {
  await page.goto('/en/v1');

  const groups = page.locator('#questionnaire .opts[role="radiogroup"]');
  await expect(groups).toHaveCount(24);
  // Each group is labelled with its own question, so a screen reader announces
  // the question rather than four bare numbers.
  for (const index of [0, 11, 23]) {
    const label = await groups.nth(index).getAttribute('aria-label');
    expect(label?.length ?? 0).toBeGreaterThan(10);
  }

  // Radios within a question share a name, so arrow keys move within the
  // question rather than across the whole form.
  const firstName = await page
    .locator('#questionnaire .qcard')
    .first()
    .locator('input[type=radio]')
    .first()
    .getAttribute('name');
  expect(firstName).toBe('q01');

  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
