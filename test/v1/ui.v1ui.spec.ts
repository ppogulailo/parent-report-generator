import { expect, test } from '@playwright/test';
import { resetMock, setMode } from './harness';

/**
 * The Version 1.0 flow in a browser: a parent answering 24 questions and
 * receiving a plan.
 *
 * The API suite proves the contract; this proves a person can actually get
 * through it. Both matter, and neither substitutes for the other — a working
 * endpoint behind a form that cannot be submitted is not a product.
 */

/** Answers every scored question by clicking the option at `index`. */
async function answerAll(page: import('@playwright/test').Page, index: number) {
  const fieldsets = page.locator('.v1-questions .v1-question');
  const count = await fieldsets.count();
  expect(count, 'the questionnaire should render 24 questions').toBe(24);

  for (let i = 0; i < count; i++) {
    await fieldsets.nth(i).locator('.v1-option input').nth(index).check();
  }
}

test('the questionnaire renders from content, in the page language', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await expect(page.locator('.v1-questions .v1-question')).toHaveCount(24);
  // The non-scored gate sits after the scored questions, so nothing about the
  // layout suggests it counts toward anything.
  await expect(page.locator('.v1-gate')).toHaveCount(1);
  await expect(page.locator('.crisis-textarea')).toBeVisible();

  await page.goto('/es/v1');
  await expect(page.locator('.v1-questions .v1-question')).toHaveCount(24);
  await expect(page.locator('.v1-legend').first()).toContainText('¿');
});

test('the draft notice is shown while the content is unapproved', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await expect(page.locator('.v1-draft')).toBeVisible();
  await expect(page.locator('.v1-draft')).toContainText('under review');
});

test('submit stays disabled until every question is answered', async ({
  page,
}) => {
  await page.goto('/en/v1');
  const submit = page.getByRole('button', { name: 'Build my plan' });
  await expect(submit).toBeDisabled();

  // One question short: still disabled, and the count says how many remain.
  const fieldsets = page.locator('.v1-questions .v1-question');
  for (let i = 0; i < 23; i++) {
    await fieldsets.nth(i).locator('.v1-option input').first().check();
  }
  await expect(
    page.locator('.v1-help', { hasText: 'still to answer' }),
  ).toContainText('1 question');
  await expect(submit).toBeDisabled();

  await fieldsets.nth(23).locator('.v1-option input').first().check();
  await expect(submit).toBeEnabled();
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
  await page.getByRole('button', { name: 'Build my plan' }).click();

  await expect(page.locator('.rv')).toBeVisible({ timeout: 60000 });

  // Severity is shown as a label and a sentence, never as a score.
  await expect(page.locator('.rv-severity-tier')).toContainText('Serious');
  await expect(page.locator('.rv')).not.toContainText('2.75');

  // Priority areas carry the matrix's own name for the area alongside the
  // model's headline.
  await expect(page.locator('.rv-rec').first()).toBeVisible();
  await expect(page.locator('.rv-rec-area').first()).not.toBeEmpty();

  // Workshops render with their category and, until ASAP supplies URLs, the
  // note explaining why they are not links.
  await expect(page.locator('.rv-workshop').first()).toBeVisible();
  await expect(page.locator('.rv-note')).toContainText('coming soon');

  // The Universal Guiding Principle is platform copy and must appear verbatim.
  await expect(page.locator('.rv')).toContainText(
    'match what you are actually seeing',
  );
});

test('the plan can be printed, and the controls are not printed with it', async ({
  page,
}) => {
  await page.goto('/en/v1');
  await answerAll(page, 0);
  await page.getByRole('button', { name: 'Build my plan' }).click();
  await expect(page.locator('.rv')).toBeVisible({ timeout: 60000 });

  await expect(
    page.getByRole('button', { name: /Print or save/ }),
  ).toBeVisible();

  // The plan is what a parent takes into a conversation, so the print view has
  // to drop the buttons and the draft banner and keep the plan.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.v1-done-actions')).toBeHidden();
  await expect(page.locator('.v1-draft')).toBeHidden();
  await expect(page.locator('.rv')).toBeVisible();
});

test('a Spanish parent gets a Spanish plan with English workshop titles', async ({
  page,
}) => {
  await page.goto('/es/v1');
  await answerAll(page, 3);
  await page.getByRole('button', { name: 'Crear mi plan' }).click();

  await expect(page.locator('.rv')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.rv-severity-label')).toContainText('Dónde');
  // Workshop titles are program resource names and stay in English.
  await expect(page.locator('.rv-workshop-title').first()).toHaveText(
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
  await page.getByRole('button', { name: 'Build my plan' }).click();

  await expect(page.getByRole('alert')).toBeVisible({ timeout: 60000 });
  // Back on the form with the answers intact, rather than a half-rendered plan.
  await expect(page.locator('.v1-questions .v1-question')).toHaveCount(24);
  await expect(page.locator('.rv')).toHaveCount(0);

  await resetMock(request);
});

test('every question is a labelled group, so a screen reader announces it', async ({
  page,
}) => {
  await page.goto('/en/v1');

  const groups = page.locator('.v1-questions fieldset');
  await expect(groups).toHaveCount(24);

  // A legend per fieldset is what makes each option announce its question
  // rather than four bare labels in a row.
  for (const index of [0, 11, 23]) {
    await expect(groups.nth(index).locator('legend')).not.toBeEmpty();
  }

  // Radios within a question share a name, so arrow keys move within the
  // question rather than across the whole form.
  const firstName = await groups
    .first()
    .locator('input[type=radio]')
    .first()
    .getAttribute('name');
  expect(firstName).toBe('q01');
});
