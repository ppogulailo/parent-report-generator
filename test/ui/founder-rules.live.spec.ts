import { test, expect, Page } from '@playwright/test';

// Live end-to-end check that the founder's three SERIOUS-tier routing rules
// land in the rendered plan. Hits the real backend on NEST_API_URL → real
// Anthropic API. Takes ~30-90s per case and costs a real model call.
//
// Rules being verified:
//   1. SERIOUS reports name "Monitoring and Intervention" as the primary group.
//   2. When that group is named, the plan also points to "Sustaining Recovery"
//      for professional-help follow-up questions.
//   3. Whenever professional support is mentioned, the plan points the parent
//      to the "Admin Space" for ASAP-endorsed providers.

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
  // The streamed plan body is rendered into the report region; grabbing the
  // whole main content is the simplest way to read it for substring checks.
  return await page.locator('main, body').first().innerText();
}

test('EN serious-tier: Monitoring and Intervention + Sustaining Recovery + Admin Space', async ({
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

  expect(text).toContain('Monitoring and Intervention');
  expect(text).toContain('Sustaining Recovery');
  expect(text).toContain('Admin Space');
});

test('ES serious-tier: Monitoring and Intervention + Sustaining Recovery + Admin Space', async ({
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

  expect(text).toContain('Monitoring and Intervention');
  expect(text).toContain('Sustaining Recovery');
  expect(text).toContain('Admin Space');
});
