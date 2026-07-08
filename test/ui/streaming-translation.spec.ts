import { test, expect, Page } from '@playwright/test';

/**
 * Reproduces Matthew's "truncated / partially-corrupted report" and proves the
 * fix.
 *
 * Root cause: the report streams in token-by-token (React mutates the text
 * nodes inside `.results` on every SSE chunk). When the page is viewed through
 * browser auto-translation (Chrome / Google Translate), the translator detaches
 * those same text nodes and swaps in <font>-wrapped translations. React's next
 * update then lands on a node the translator already removed, so sentence tails
 * silently vanish and identical phrases get re-translated inconsistently
 * ("therapist ASAP-endorsed" vs "therapist-endorsed ASAP").
 *
 * Fix: the results region carries translate="no" permanently, so the browser
 * translator never touches it — not while React is streaming into it, and not
 * after. The plan is authored by the backend in the language the user selected
 * (EN or ES), so it must stay in that language start to finish and must never
 * be re-translated (which would both corrupt the stream and visibly flip the
 * completed plan's language). Real browsers honour translate="no" — these tests
 * install a faithful translator emulator that does the same.
 */

// Distinctive COMPLETE sentences from the streamed plan. Each maps to one of
// the fragments Matthew reported as truncated.
const KEY_SENTENCES = [
  'que incluye como involucrar a la escuela y a la comunidad.', // "...involve the school and…"
  'un terapeuta avalado por ASAP es el siguiente paso.', //          "therapist ASAP-endorsed"
  'habla de lo que observaste y escucha sin interrumpir.', //        "...talk about what you observed,"
  'tu hijo no es el enemigo, y no estas solo en esto.', //           "...your child is not…"
];

// Faithful Google-Translate emulator: walks text nodes and replaces each with a
// detached <font> wrapper (exactly the move that races React), but SKIPS any
// subtree marked translate="no" / .notranslate — just like a real browser. The
// `__IGNORE_TRANSLATE_NO` flag simulates the pre-fix world (no gate) for the
// control test.
function installTranslatorEmulator(): string {
  return `(() => {
    const W = window;
    W.__gt = { translated: 0 };
    const isProtected = (node) => {
      let el = node.nodeType === 1 ? node : node.parentElement;
      while (el) {
        if (el.nodeType === 1) {
          if (W.__IGNORE_TRANSLATE_NO && el.classList && el.classList.contains('results')) return false;
          if (el.getAttribute && el.getAttribute('translate') === 'no') return true;
          if (el.classList && el.classList.contains('notranslate')) return true;
        }
        el = el.parentElement;
      }
      return false;
    };
    const scan = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = n.parentNode;
          if (p && p.__gt) return NodeFilter.FILTER_REJECT;
          if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) return NodeFilter.FILTER_REJECT;
          if (isProtected(n)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes = [];
      let cur;
      while ((cur = walker.nextNode())) nodes.push(cur);
      for (const tn of nodes) {
        if (!tn.parentNode) continue;
        const font = document.createElement('font');
        font.__gt = true;
        font.setAttribute('data-gt', '1');
        // Keep the content (wrapped in guillemets) so a clean run is fully
        // recoverable; a frozen/raced node simply keeps a stale snapshot.
        font.appendChild(document.createTextNode('\\u00AB' + tn.nodeValue + '\\u00BB'));
        tn.parentNode.replaceChild(font, tn);
        W.__gt.translated++;
      }
    };
    setInterval(scan, 20);
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();`;
}

// Records, throughout generation, whether the translator ever entered the live
// `.results` region while it was still streaming, plus the translate-attr
// timeline.
function installRecorder(): string {
  return `(() => {
    const W = window;
    W.__rec = { sawFontInResultsWhileWriting: false, maxFontsWhileWriting: 0, transitions: [] };
    W.__recTimer = setInterval(() => {
      const r = document.querySelector('.results');
      const stage = (document.querySelector('.status-title') || {}).textContent || '';
      const t = r ? r.getAttribute('translate') : '(none)';
      const writing = /Escribiendo|Calculando/.test(stage);
      const fonts = r ? r.querySelectorAll('font[data-gt]').length : 0;
      if (writing && fonts > 0) W.__rec.sawFontInResultsWhileWriting = true;
      if (writing) W.__rec.maxFontsWhileWriting = Math.max(W.__rec.maxFontsWhileWriting, fonts);
      const key = stage.trim() + ' | translate=' + t;
      const last = W.__rec.transitions[W.__rec.transitions.length - 1];
      if (last !== key) W.__rec.transitions.push(key);
    }, 20);
  })();`;
}

async function generatePlan(page: Page): Promise<void> {
  await page.goto('/es');
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-hydrated') === 'true',
    undefined,
    { timeout: 30000 },
  );
  await page.evaluate(installRecorder());
  await page.locator('.dev-fill').click();
  await expect(page.locator('button.submit')).toBeEnabled();
  await page.locator('button.submit').click();
  await page.getByText('Tu plan está listo.').waitFor({ timeout: 40000 });
  await page.evaluate(() => clearInterval((window as any).__recTimer));
}

function resultsPlainText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const r = document.querySelector('.results') as HTMLElement | null;
    return (r?.innerText || '').replace(/[«»]/g, '');
  });
}

type Recording = {
  sawFontInResultsWhileWriting: boolean;
  maxFontsWhileWriting: number;
  transitions: string[];
};

function fontsInResults(page: Page): Promise<number> {
  return page.evaluate(
    () => document.querySelectorAll('.results font[data-gt]').length,
  );
}

test.describe('browser auto-translation vs. streaming report', () => {
  test('FIX: translate="no" keeps the translator out of the live region — plan streams complete', async ({
    page,
  }) => {
    await page.addInitScript(installTranslatorEmulator());
    await generatePlan(page);

    const rec = (await page.evaluate(
      () => (window as any).__rec,
    )) as Recording;
    const gtTranslated = (await page.evaluate(
      () => (window as any).__gt.translated,
    )) as number;

    // The translator really was running page-wide...
    expect(gtTranslated).toBeGreaterThan(0);
    // ...but it NEVER entered the results region while it was streaming.
    expect(rec.sawFontInResultsWhileWriting).toBe(false);
    // The gate is on during writing...
    expect(rec.transitions.some((t) => /Escribiendo.*translate=no/.test(t))).toBe(
      true,
    );
    // ...and STAYS on after completion. The plan is authored by the backend in
    // the language the user selected, so it must display in that language start
    // to finish and must never be re-translated by the browser (founder
    // requirement — the completed plan used to visibly flip languages when the
    // gate released to translate="yes"; that release is now gone).
    expect(rec.transitions[rec.transitions.length - 1]).toMatch(/translate=no/);

    // Every previously-truncated sentence is present in full.
    const text = await resultsPlainText(page);
    for (const sentence of KEY_SENTENCES) {
      expect(text).toContain(sentence);
    }

    // The translator never enters the results region — not even after the
    // stream is done — so the plan stays in the selected/authored language.
    expect(await fontsInResults(page)).toBe(0);
  });

  test('CONTROL: without the gate, the translator races React inside the live region', async ({
    page,
  }) => {
    await page.addInitScript(installTranslatorEmulator());
    // Simulate the pre-fix world: the translator is free to rewrite the
    // streaming results region while React is still mutating it.
    await page.addInitScript(() => {
      (window as any).__IGNORE_TRANSLATE_NO = true;
    });
    await generatePlan(page);

    const rec = (await page.evaluate(
      () => (window as any).__rec,
    )) as Recording;

    // The translator detached and rewrote React's text nodes INSIDE the live
    // region, repeatedly, while the plan was still streaming. This is the exact
    // race that drops sentence tails and double-translates phrases in
    // production — and that previously caused the insertBefore crash. The fix
    // (translate="no" always) makes this impossible; see the FIX test,
    // where this same emulator never enters the region.
    expect(rec.sawFontInResultsWhileWriting).toBe(true);
    expect(rec.maxFontsWhileWriting).toBeGreaterThan(0);
    // The gate attribute is even present (translate=no) yet, because this run
    // ignores it, the translator went in anyway — proving the corruption is
    // gated solely by the browser honouring translate="no".
    expect(rec.transitions.some((t) => /Escribiendo.*translate=no/.test(t))).toBe(
      true,
    );
  });
});
