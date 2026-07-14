import { test, expect, Page } from '@playwright/test';

// Browser-level review of the Beta-finalization CONSIDERING INPATIENT TREATMENT
// section: it renders as its own card in the CRITICAL (crisis) plan and is
// absent from a non-crisis plan. Drives the real Next.js frontend → NestJS
// backend → (mock) generation stack booted by the global-setup.

const CRISIS_EN = 'Suspected overdose last night, and my child talked about ending it.';
const CRISIS_ES = 'Sospecha de sobredosis anoche, y mi hijo habló de terminar con todo.';

async function hydrate(page: Page, lang: 'en' | 'es'): Promise<void> {
  await page.goto(`/${lang}`);
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-hydrated') === 'true',
    undefined,
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Prefill sample answers' }).click();
}

async function submitAndWait(
  page: Page,
  generateLabel: string,
  doneTitle: string,
): Promise<void> {
  const generate = page
    .getByRole('button', { name: generateLabel })
    .first();
  await expect(generate).toBeEnabled();
  await generate.click();
  await page.getByText(doneTitle).waitFor({ timeout: 45000 });
}

test('EN: CRITICAL plan renders the CONSIDERING INPATIENT TREATMENT card', async ({
  page,
}) => {
  await hydrate(page, 'en');
  await page.locator('#crisis-textarea').fill(CRISIS_EN);
  await submitAndWait(page, 'Generate Action Plan', 'Your plan is ready.');

  const heading = page.getByRole('heading', {
    name: 'Considering Inpatient Treatment',
  });
  await expect(heading).toBeVisible();

  const results = page.locator('.results');
  await expect(results).toContainText('inpatient or residential treatment');
  await expect(results).toContainText('Your child is a danger to themselves.');
  await expect(results).toContainText(
    'significant risk of overdose or death',
  );
  await expect(results).toContainText('not a failure');

  await page.screenshot({
    path: 'test-results/critical-inpatient-en.png',
    fullPage: true,
  });
});

test('ES: el plan CRÍTICO muestra la tarjeta CONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL', async ({
  page,
}) => {
  await hydrate(page, 'es');
  await page.locator('#crisis-textarea').fill(CRISIS_ES);
  await submitAndWait(page, 'Generar plan de acción', 'Tu plan está listo.');

  const heading = page.getByRole('heading', {
    name: 'Considerar el tratamiento interno o residencial',
  });
  await expect(heading).toBeVisible();

  const results = page.locator('.results');
  await expect(results).toContainText('Tu hijo es un peligro para sí mismo.');
  await expect(results).toContainText('no es un fracaso');

  await page.screenshot({
    path: 'test-results/critical-inpatient-es.png',
    fullPage: true,
  });
});

test('EN: a non-crisis plan does NOT render the inpatient card', async ({
  page,
}) => {
  await hydrate(page, 'en');
  // No crisis field → non-crisis report → the conditional section is absent.
  await submitAndWait(page, 'Generate Action Plan', 'Your plan is ready.');

  await expect(
    page.getByRole('heading', { name: 'Considering Inpatient Treatment' }),
  ).toHaveCount(0);
});
