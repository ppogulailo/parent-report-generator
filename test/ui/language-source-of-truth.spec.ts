import { test, expect, Page, Request } from '@playwright/test';

/**
 * Matt's beta blocker: "the report-generation language must follow the language
 * actively selected and displayed in the questionnaire — not a stale URL route,
 * prior language state, or browser translation setting."
 *
 * These tests intercept the outgoing /api/report/stream request and assert its
 * `language` field equals the language the user currently SEES selected, across:
 *   - a direct /en visit,
 *   - a direct /es visit,
 *   - switching the visible language toggle before generating.
 * They also assert the document truthfully declares its language (<html lang>)
 * and that browser auto-translation is suppressed (translate="no").
 */

const SAMPLE = [4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3];

const SSE_OK =
  'event: scores\n' +
  'data: {"domainScores":{"Immediate Safety & Urgency":3.5,"Boundary Consistency":2.1,"Communication & Conflict":2.4,"Support & Professional Engagement":2.0},"topDomains":["Immediate Safety & Urgency","Communication & Conflict","Boundary Consistency"],"severity":"SERIOUS"}\n\n' +
  'event: text\ndata: {"text":"section body"}\n\n' +
  'event: done\ndata: {}\n\n';

async function interceptLanguage(page: Page): Promise<{ value: string | null }> {
  const box: { value: string | null } = { value: null };
  await page.route('**/api/report/stream', async (route) => {
    const json = route.request().postDataJSON() as { language?: string } | null;
    box.value = json?.language ?? null;
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: SSE_OK,
    });
  });
  return box;
}

async function waitHydrated(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-hydrated') === 'true',
    undefined,
    { timeout: 30000 },
  );
}

async function fillAndGenerate(page: Page) {
  await page.getByRole('button', { name: /Prefill sample answers/i }).click();
  const gen = page.locator('button.btn-full');
  await expect(gen).toBeEnabled();
  await gen.click();
}

function activeToggleLang(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.querySelector('.langswitch .lang-label.active');
    return active ? active.textContent!.trim().toLowerCase() : null;
  });
}

function htmlAttrs(page: Page) {
  return page.evaluate(() => ({
    lang: document.documentElement.getAttribute('lang'),
    translate: document.documentElement.getAttribute('translate'),
  }));
}

test.describe('report language = visibly selected language (single source of truth)', () => {
  test('SSR declares the route language in <html lang> and suppresses translation', async ({
    request,
  }) => {
    const esHtml = await (await request.get('/es')).text();
    expect(esHtml, 'SSR /es must declare lang="es"').toMatch(/<html[^>]*\blang="es"/);
    expect(esHtml).toMatch(/<html[^>]*\btranslate="no"/);
    expect(esHtml).toMatch(/name="google"\s+content="notranslate"/);

    const enHtml = await (await request.get('/en')).text();
    expect(enHtml, 'SSR /en must declare lang="en"').toMatch(/<html[^>]*\blang="en"/);
    expect(enHtml).toMatch(/<html[^>]*\btranslate="no"/);
  });

  test('direct /en → request language is "en", and toggle shows EN', async ({ page }) => {
    const lang = await interceptLanguage(page);
    await page.goto('/en');
    await waitHydrated(page);

    expect(await activeToggleLang(page)).toBe('en');
    const attrs = await htmlAttrs(page);
    expect(attrs.lang).toBe('en');
    expect(attrs.translate).toBe('no');

    await fillAndGenerate(page);
    await expect.poll(() => lang.value).toBe('en');
  });

  test('direct /es → request language is "es", document declares es, translation suppressed', async ({
    page,
  }) => {
    const lang = await interceptLanguage(page);
    await page.goto('/es');
    await waitHydrated(page);

    expect(await activeToggleLang(page)).toBe('es');
    const attrs = await htmlAttrs(page);
    // The document must truthfully declare Spanish (was hardcoded "en" — bug).
    expect(attrs.lang).toBe('es');
    // Browser auto-translation must be off so displayed language == selected.
    expect(attrs.translate).toBe('no');

    await fillAndGenerate(page);
    await expect.poll(() => lang.value).toBe('es');
  });

  test('switching the visible toggle EN→ES→EN drives the request language each time', async ({
    page,
  }) => {
    const lang = await interceptLanguage(page);

    // Start English.
    await page.goto('/en');
    await waitHydrated(page);
    expect(await activeToggleLang(page)).toBe('en');

    // Switch to Spanish via the visible toggle.
    await page.locator('.langswitch a', { hasText: 'ES' }).click();
    await page.waitForURL('**/es');
    await waitHydrated(page);
    expect(await activeToggleLang(page)).toBe('es');
    expect((await htmlAttrs(page)).lang).toBe('es');

    await fillAndGenerate(page);
    await expect.poll(() => lang.value).toBe('es');

    // Switch back to English and generate again — must not be a stale "es".
    lang.value = null;
    await page.locator('.langswitch a', { hasText: 'EN' }).click();
    await page.waitForURL('**/en');
    await waitHydrated(page);
    expect(await activeToggleLang(page)).toBe('en');
    expect((await htmlAttrs(page)).lang).toBe('en');

    await fillAndGenerate(page);
    await expect.poll(() => lang.value).toBe('en');
  });
});
