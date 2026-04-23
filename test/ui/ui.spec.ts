import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait until React has hydrated — the page sets data-hydrated on <html>
  // in a top-level useEffect, so once this attribute exists, click handlers
  // are attached and state updates will take effect.
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-hydrated') === 'true',
    undefined,
    { timeout: 30000 },
  );
});

// ─── Hero + language toggle ──────────────────────────────────────────────────

test('loads the English hero + language toggle by default', async ({
  page,
}) => {
  await expect(page).toHaveTitle(/Parent Action Plan/);
  await expect(
    page.getByRole('heading', {
      name: 'A calm, clear plan when you need it most',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('switches to Spanish UI when Español is clicked', async ({ page }) => {
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Un plan claro y con los pies en la tierra, cuando más lo necesitas',
    }),
  ).toBeVisible();
  // Scale labels localized
  await expect(page.getByText('1 — Sólido').first()).toBeVisible();
  await expect(page.getByText('4 — Preocupante').first()).toBeVisible();
  // Submit button label translated (still disabled, count starts at 0)
  await expect(
    page.getByRole('button', { name: 'Generar plan de acción' }),
  ).toBeVisible();
  // Progress counter text localized
  await expect(page.getByText('Respondidas 0 de 24')).toBeVisible();
  // html lang attribute flips
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('toggles back to English cleanly', async ({ page }) => {
  await page.getByRole('button', { name: 'Español' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Answered 0 of 24')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate Action Plan' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

// ─── Questionnaire progress + submit gating ──────────────────────────────────

test('submit button is disabled until all 24 questions are answered', async ({
  page,
}) => {
  const submit = page.getByRole('button', { name: 'Generate Action Plan' });
  await expect(submit).toBeDisabled();
  await expect(
    page.getByText('Answer all 24 questions to generate your plan.'),
  ).toBeVisible();
});

test('progress counter updates as answers are selected', async ({ page }) => {
  await expect(page.getByText('Answered 0 of 24')).toBeVisible();
  // Answer question 1
  await page.locator('input[name="q-0"][value="2"]').check({ force: true });
  await expect(page.getByText('Answered 1 of 24')).toBeVisible();
  // Answer question 2
  await page.locator('input[name="q-1"][value="3"]').check({ force: true });
  await expect(page.getByText('Answered 2 of 24')).toBeVisible();
});

test('"Jump to next unanswered" appears after partial answers and scrolls', async ({
  page,
}) => {
  await page.locator('input[name="q-0"][value="2"]').check({ force: true });
  const jump = page.getByRole('button', { name: 'Jump to next unanswered' });
  await expect(jump).toBeVisible();
  await jump.click();
  // Wait for smooth-scroll to settle, then verify q-1 is in the viewport.
  await page.waitForTimeout(500);
  const inView = await page.locator('#q-1').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.top >= 0 &&
      r.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );
  });
  expect(inView).toBe(true);
});

test('sample-fill button answers all 24 and enables submit', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Fill sample answers' }).click();
  await expect(page.getByText('Answered 24 of 24')).toBeVisible();
  const submit = page.getByRole('button', { name: 'Generate Action Plan' });
  await expect(submit).toBeEnabled();
});

test('Spanish sample-fill localizes the counter', async ({ page }) => {
  await page.getByRole('button', { name: 'Español' }).click();
  await page
    .getByRole('button', { name: 'Llenar con respuestas de ejemplo' })
    .click();
  await expect(page.getByText('Respondidas 24 de 24')).toBeVisible();
});

test('all 24 questions render with 4-point scales in both languages', async ({
  page,
}) => {
  // English
  await expect(page.locator('.question')).toHaveCount(24);
  await expect(page.locator('input[type="radio"]')).toHaveCount(96);
  // Spanish
  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.locator('.question')).toHaveCount(24);
  // First Spanish question text visible
  await expect(
    page.getByText(
      '¿Qué tan seguro estás de que tu hijo ha consumido drogas',
    ),
  ).toBeVisible();
});

// ─── Generation flow (stubbed SSE) ───────────────────────────────────────────

const mockSseStream = (language: 'en' | 'es') => {
  const header =
    language === 'es' ? 'RESUMEN INICIAL' : 'HEADLINE SUMMARY';
  const top =
    language === 'es'
      ? '3 PRIORIDADES INMEDIATAS'
      : 'TOP 3 IMMEDIATE PRIORITIES';
  const key = language === 'es' ? 'PRIORIDADES CLAVE' : 'KEY PRIORITIES';
  const avoid = language === 'es' ? 'QUÉ EVITAR' : 'WHAT TO AVOID';
  const plan =
    language === 'es'
      ? 'PLAN DE LAS PRIMERAS 72 HORAS'
      : 'FIRST 72 HOURS PLAN';
  const days =
    language === 'es' ? 'DÍAS 4 A 7 — CONTINUACIÓN' : 'DAYS 4 TO 7 CONTINUATION';
  const enc =
    language === 'es'
      ? 'ALIENTO Y DIRECCIÓN'
      : 'ENCOURAGEMENT AND DIRECTION';

  const planText = [
    header,
    language === 'es'
      ? 'Un resumen firme y con los pies en la tierra.'
      : 'A calm, grounded overview of the situation.',
    '',
    top,
    '- ' +
      (language === 'es'
        ? 'Regulación emocional primero.'
        : 'Parent regulation first.'),
    '- ' +
      (language === 'es'
        ? 'Alinea con el co-padre.'
        : 'Align with co-parent.'),
    '- ' +
      (language === 'es'
        ? 'Construye un grupo de apoyo.'
        : 'Build a support group.'),
    '',
    key,
    language === 'es'
      ? 'Concentrarse en Immediate Safety & Urgency primero.'
      : 'Focus on Immediate Safety & Urgency first.',
    '',
    avoid,
    '- ' +
      (language === 'es'
        ? 'Evita ultimátums sin plan de seguimiento.'
        : 'Avoid ultimatums without follow-through.'),
    '',
    plan,
    language === 'es'
      ? 'Día 1: regulación. Día 2: apoyo. Día 3: conversación.'
      : 'Day 1: regulation. Day 2: support. Day 3: conversation.',
    '',
    days,
    '- ' +
      (language === 'es'
        ? 'Continúa los chequeos diarios.'
        : 'Continue daily check-ins.'),
    '',
    enc,
    language === 'es'
      ? 'Esto requiere determinación y perseverancia.'
      : 'This takes determination and perseverance.',
  ].join('\n');

  const scoresPayload = JSON.stringify({
    type: 'scores',
    language,
    domainScores: {
      'Immediate Safety & Urgency': 2.4,
      'Household Structure': 2.0,
      'Boundary Consistency': 2.2,
      'Communication & Conflict': 2.6,
      'Support & Professional Engagement': 2.2,
    },
    topDomains: [
      'Communication & Conflict',
      'Immediate Safety & Urgency',
      'Boundary Consistency',
    ],
  });
  const textPayload = JSON.stringify({ type: 'text', text: planText });
  const donePayload = JSON.stringify({ type: 'done' });

  return [
    `event: scores\ndata: ${scoresPayload}\n\n`,
    `event: text\ndata: ${textPayload}\n\n`,
    `event: done\ndata: ${donePayload}\n\n`,
  ].join('');
};

async function stubStream(page, language: 'en' | 'es') {
  await page.route('**/api/report/stream', (route) => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: mockSseStream(language),
    });
  });
}

test('full English flow: fill sample → submit → render report', async ({
  page,
}) => {
  await stubStream(page, 'en');
  await page.getByRole('button', { name: 'Fill sample answers' }).click();
  await page.getByRole('button', { name: 'Generate Action Plan' }).click();

  await expect(page.getByText('Your plan is ready.')).toBeVisible({
    timeout: 10000,
  });

  // Report sections rendered with English labels
  await expect(page.getByText('Headline Summary', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Top 3 Immediate Priorities', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('First 72 Hours Plan', { exact: true }),
  ).toBeVisible();

  // Body renders
  await expect(
    page.getByText('A calm, grounded overview of the situation.'),
  ).toBeVisible();
  // Bullet list rendered
  await expect(page.getByText('Parent regulation first.')).toBeVisible();

  // Domain scores + top priorities
  await expect(page.getByText('Domain Scores')).toBeVisible();
  await expect(page.getByText('Top Priorities')).toBeVisible();
  await expect(page.locator('.top-domain')).toHaveCount(3);
  await expect(page.locator('.score-row')).toHaveCount(5);
});

test('full Spanish flow: toggle, fill, submit → Spanish report renders', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Español' }).click();
  await stubStream(page, 'es');
  await page
    .getByRole('button', { name: 'Llenar con respuestas de ejemplo' })
    .click();
  await page.getByRole('button', { name: 'Generar plan de acción' }).click();

  await expect(page.getByText('Tu plan está listo.')).toBeVisible({
    timeout: 10000,
  });

  // Spanish section labels
  await expect(page.getByText('Resumen inicial', { exact: true })).toBeVisible();
  await expect(
    page.getByText('3 Prioridades inmediatas', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Plan de las primeras 72 horas', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Días 4 a 7 — Continuación', { exact: true }),
  ).toBeVisible();

  // Spanish body rendered
  await expect(
    page.getByText('Regulación emocional primero.'),
  ).toBeVisible();

  // Domain / top priority headings localized
  await expect(page.getByText('Puntajes por dominio')).toBeVisible();
  await expect(page.getByText('Prioridades principales')).toBeVisible();
});

test('backend failure renders the retry error state', async ({ page }) => {
  await page.route('**/api/report/stream', (route) => {
    route.fulfill({
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Could not reach NestJS API.',
      }),
    });
  });

  await page.getByRole('button', { name: 'Fill sample answers' }).click();
  await page.getByRole('button', { name: 'Generate Action Plan' }).click();

  await expect(page.getByText('Something went wrong.')).toBeVisible();
  await expect(page.getByText('Could not reach NestJS API.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
