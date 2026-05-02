import { test, expect, Page } from '@playwright/test';

// Live end-to-end check that the founder's refinements land in the plan
// rendered by the frontend. Drives the Next.js UI on :3100, which streams
// from the real NestJS backend → real Anthropic API. Each case is one paid
// generation and takes ~30-90s.
//
// Rules being verified (refined set):
//   1. Discussion groups are named in canonical form: "<Title> discussion group".
//   2. SERIOUS reports name the "Monitoring and Intervention discussion group"
//      as the primary support recommendation.
//   3. Whenever the "Sustaining Recovery discussion group" is referenced, it is
//      immediately followed by the verbatim sentence:
//      "In Admin Spaces you can find a listing of treatment providers &
//       therapists who endorse and support the ASAP program."
//   4. Action language ("join the" / "reach out to") is used to direct the
//      parent into the group — not passive phrasing.
//   5. Banned phrasing: "avoid searching" never appears. The phrase
//      "Do not search your child's room or phone in a confrontational way"
//      is allowed (and expected when secrecy/hidden-use signals are present).
//   6. Substance-use-as-opponent framing: the child is not the opponent.
//      Look for "against the drugs" / "not the opponent".

test.describe.configure({ mode: 'serial' });

async function gotoLang(page: Page, lang: 'en' | 'es') {
  await page.goto(`/${lang}`);
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-hydrated') === 'true',
    undefined,
    { timeout: 30000 },
  );
}

async function fillAllFours(page: Page) {
  for (let i = 0; i < 24; i += 1) {
    await page
      .locator(`#q-${i} label`)
      .filter({ has: page.locator('input[value="4"]') })
      .click();
  }
}

async function readReportText(page: Page): Promise<string> {
  return await page.locator('main, body').first().innerText();
}

const ADMIN_SPACES_SENTENCE =
  'In Admin Spaces you can find a listing of treatment providers & therapists who endorse and support the ASAP program.';

function assertSrFollowedByAdminSpaces(text: string) {
  // Every "Sustaining Recovery discussion group" reference must be followed
  // (within ~400 chars, allowing for prose padding) by the verbatim sentence.
  const re = /Sustaining Recovery discussion group/g;
  const matches = [...text.matchAll(re)];
  expect(matches.length).toBeGreaterThanOrEqual(1);
  for (const m of matches) {
    const window = text.slice(m.index ?? 0, (m.index ?? 0) + 600);
    expect(
      window.includes(ADMIN_SPACES_SENTENCE),
      `expected Admin Spaces follow-on within 600 chars after Sustaining Recovery reference at index ${m.index}; window was:\n${window}`,
    ).toBe(true);
  }
}

function assertNoBannedConfront(text: string) {
  // "confrontational way" is the founder-approved phrasing and must be allowed.
  // Strip those occurrences first, then scan for any remaining "confront*".
  const stripped = text.replace(/confrontational/gi, '');
  expect(stripped, 'banned word "confront" leaked into plan').not.toMatch(
    /confront/i,
  );
}

test('EN SERIOUS (all 4s): canonical naming + Admin Spaces sentence + framing', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await gotoLang(page, 'en');
  await fillAllFours(page);
  await page.getByRole('button', { name: 'Generate Action Plan' }).click();
  await expect(page.getByText('Your plan is ready.')).toBeVisible({
    timeout: 150_000,
  });

  const text = await readReportText(page);
  console.log('\n──────── EN PLAN (SERIOUS, all 4s) ────────\n' + text + '\n');

  // 1. Canonical naming
  expect(text).toContain('Monitoring and Intervention discussion group');
  expect(text).toContain('Sustaining Recovery discussion group');

  // 2. Verbatim Admin Spaces follow-on after every SR reference
  assertSrFollowedByAdminSpaces(text);

  // 3. Action language present
  expect(text).toMatch(/join the|reach out to/i);

  // 4. Banned phrasing
  expect(text).not.toMatch(/avoid searching/i);
  assertNoBannedConfront(text);

  // 5. Substance-use-as-opponent framing
  expect(text).toMatch(/against the drugs|not the opponent/i);
});

test('EN MILD (all 1s): groups still reinforced, no SERIOUS routing, no banned words', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await gotoLang(page, 'en');
  for (let i = 0; i < 24; i += 1) {
    await page
      .locator(`#q-${i} label`)
      .filter({ has: page.locator('input[value="1"]') })
      .click();
  }
  await page.getByRole('button', { name: 'Generate Action Plan' }).click();
  await expect(page.getByText('Your plan is ready.')).toBeVisible({
    timeout: 150_000,
  });

  const text = await readReportText(page);
  console.log('\n──────── EN PLAN (MILD, all 1s) ────────\n' + text + '\n');

  // Discussion groups are reinforced as a primary support mechanism in every
  // report, even MILD — name at least one in canonical form.
  expect(text).toMatch(/discussion group/i);

  // MILD must NOT escalate to the Monitoring-and-Intervention group.
  expect(text).not.toMatch(/Monitoring and Intervention/);

  // Banned phrasings still apply.
  expect(text).not.toMatch(/avoid searching/i);
  assertNoBannedConfront(text);
});

test('ES GRAVE (all 4s): canonical English titles + Admin Spaces sentence verbatim', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await gotoLang(page, 'es');
  await fillAllFours(page);
  await page.getByRole('button', { name: 'Generar plan de acción' }).click();
  await expect(page.getByText('Tu plan está listo.')).toBeVisible({
    timeout: 150_000,
  });

  const text = await readReportText(page);
  console.log('\n──────── ES PLAN (GRAVE, all 4s) ────────\n' + text + '\n');

  // ASAP titles stay in English even in Spanish output.
  expect(text).toContain('Monitoring and Intervention discussion group');
  expect(text).toContain('Sustaining Recovery discussion group');

  // The Admin Spaces follow-on is required verbatim in English.
  assertSrFollowedByAdminSpaces(text);

  // Action language in Spanish.
  expect(text).toMatch(/únete al|acércate al|reach out to|join the/i);

  // Banned phrasings (Spanish + English).
  expect(text).not.toMatch(/evita revisar|avoid searching/i);
  // Allow "manera confrontativa" / "confrontational way"; flag any other confront* usage.
  const stripped = text
    .replace(/confrontational/gi, '')
    .replace(/confrontativa/gi, '');
  expect(stripped).not.toMatch(/confront/i);

  // Substance-use-as-opponent framing.
  expect(text).toMatch(/contra las drogas|against the drugs|no es el oponente|not the opponent/i);
});
