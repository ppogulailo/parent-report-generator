import { test, expect } from '@playwright/test';
import { SYSTEM_PROMPT } from '../src/report/prompts/system.prompt';
import { SYSTEM_PROMPT_ES } from '../src/report/prompts/system.prompt.es';
import {
  SECTION_HEADERS_EN,
  SECTION_HEADERS_ES,
} from '../src/report/prompts/user.prompt';
import {
  DISCUSSION_GROUPS,
  AUXILIARY_WORKSHOPS,
} from '../src/report/prompts/resources';

// ─────────────────────────────────────────────────────────────────────────────
// Beta Finalization milestone — item 3: verification of all eight Parent Action
// Plans (English + Spanish × Mild / Moderate / Serious / Critical).
//
// SCOPE OF THIS FILE (what Playwright CAN verify — the request the model receives):
//   • language selection routes to the correct system prompt;
//   • severity classification produces the right tier per input (Critical = the
//     crisis/URGENT overlay that force-promotes to SERIOUS/GRAVE);
//   • the approved resource directory ships with the correct workshop + discussion
//     group set (including the founder-approved "Protecting Recovery" additions);
//   • the standardized closing is gated to Moderate/Serious/Critical and excluded
//     from Mild;
//   • report generation returns 200 for every variant (no regressions).
//
// OUT OF SCOPE HERE (needs real generation + human/founder review, not the mock):
//   • the actual prose quality of each generated plan;
//   • "all Founder editorial comments incorporated" (item 2 — pending the notes);
//   • final Founder approval / Beta sign-off (the acceptance criterion).
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';

const post = (request: any, body: unknown) =>
  request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    data: body,
  });

const getLastCaptured = async () => (await fetch(`${MOCK_BASE}/_last`)).json();

const CRISIS = 'Found an unknown substance in the bedroom. Worried about fentanyl.';

type Tier = 'Mild' | 'Moderate' | 'Serious' | 'Critical';
type Lang = 'en' | 'es';

// Inputs that deterministically land each tier. Critical = Moderate scores + a
// crisis field, which force-promotes to SERIOUS/GRAVE and adds the URGENT overlay.
const INPUTS: Record<Tier, { responses: number[]; crisis?: string }> = {
  Mild: { responses: Array(24).fill(1) },
  Moderate: { responses: Array(24).fill(2) },
  Serious: { responses: Array(24).fill(4) },
  Critical: { responses: Array(24).fill(2), crisis: CRISIS },
};

// Expected severity label as it appears in the outgoing user prompt, per language.
const SEVERITY_LABEL: Record<Lang, Record<Tier, string>> = {
  en: {
    Mild: 'SEVERITY LEVEL: MILD',
    Moderate: 'SEVERITY LEVEL: MODERATE',
    Serious: 'SEVERITY LEVEL: SERIOUS',
    Critical: 'SEVERITY LEVEL: SERIOUS', // crisis force-promotes
  },
  es: {
    Mild: 'SEVERITY LEVEL: LEVE',
    Moderate: 'SEVERITY LEVEL: MODERADO',
    Serious: 'SEVERITY LEVEL: GRAVE',
    Critical: 'SEVERITY LEVEL: GRAVE',
  },
};

const SYSTEM_PROMPT_FOR: Record<Lang, string> = {
  en: SYSTEM_PROMPT,
  es: SYSTEM_PROMPT_ES,
};

const HEADERS_FOR: Record<Lang, readonly string[]> = {
  en: SECTION_HEADERS_EN,
  es: SECTION_HEADERS_ES,
};

const LANGS: Lang[] = ['en', 'es'];
const TIERS: Tier[] = ['Mild', 'Moderate', 'Serious', 'Critical'];

for (const lang of LANGS) {
  for (const tier of TIERS) {
    test(`8-plan matrix: ${lang.toUpperCase()} ${tier} generates + routes correctly`, async ({
      request,
    }) => {
      const res = await post(request, { ...INPUTS[tier], language: lang });
      // Report generation functions correctly.
      expect(res.status()).toBe(200);

      const captured = await getLastCaptured();
      const systemContent: string = captured.body.messages[0].content;
      const userContent: string = captured.body.messages[1].content;

      // Language selection → correct system prompt (methodology delivered intact).
      expect(systemContent).toBe(SYSTEM_PROMPT_FOR[lang]);

      // Severity classification is correct for this tier.
      expect(userContent).toContain(SEVERITY_LABEL[lang][tier]);

      // Section headers are in the selected language.
      for (const header of HEADERS_FOR[lang]) {
        expect(userContent).toContain(header);
      }

      // Workshop + discussion-group directory ships with the founder-approved set.
      expect(userContent).toContain('ASAP Discussion Groups (3 approved');
      expect(userContent).toContain('Auxiliary Workshops (21 total');
      expect(userContent).toContain(
        'Protecting Recovery: Preventing Relapse and Responding to Setbacks',
      );

      // The standardized-closing scope label is present and tier-scoped in every
      // variant (the model is told which tiers it applies to).
      expect(userContent).toMatch(
        /STANDARDIZED CLOSING.*MODERAT[EO].*(SERIOUS|GRAVE).*(CRITICAL|CRÍTICO)/s,
      );

      if (tier === 'Critical') {
        // The crisis overlay is present: the parent's flagged concern is carried in.
        expect(userContent).toContain(CRISIS);
      }
    });
  }
}

// ─── Cross-cutting guarantees (methodology / gating), language-agnostic ───────

test('Beta verify: standardized closing is gated to Moderate/Serious/Critical, excluded from Mild (EN+ES)', () => {
  expect(SYSTEM_PROMPT).toMatch(/MILD reports do NOT include it/);
  expect(SYSTEM_PROMPT_ES).toMatch(/los reportes LEVE NO lo incluyen/);
});

test('Beta verify: the two Protecting Recovery resources are registered', () => {
  expect(DISCUSSION_GROUPS).toContain('Protecting Recovery');
  expect(AUXILIARY_WORKSHOPS.map((w) => w.title)).toContain(
    'Protecting Recovery: Preventing Relapse and Responding to Setbacks',
  );
});

test('Beta item 2: Founder readability directive is wired (EN only)', () => {
  // Readability pass driven by the Founder's review notes. English system prompt
  // only — Spanish is the quality bar and is left unchanged.
  expect(SYSTEM_PROMPT).toContain('ENGLISH READABILITY & FLOW');
  expect(SYSTEM_PROMPT).toMatch(
    /clarity, grammar, natural flow, and professionalism as the Spanish/,
  );
  // Founder-specific points captured verbatim in the directive:
  expect(SYSTEM_PROMPT).toContain('Emotional Regulation for Fathers'); // banned form named
  expect(SYSTEM_PROMPT).toMatch(/use "co-parent" \(or "caregiver"/);
  expect(SYSTEM_PROMPT).toContain("Don't warn your child beforehand.");
  expect(SYSTEM_PROMPT).toContain('Let tiredness and fear speak first'); // banned example named
  expect(SYSTEM_PROMPT_ES).not.toContain('ENGLISH READABILITY & FLOW');
});

test('Beta verify: founder-approved closing text ships verbatim (EN+ES)', () => {
  // English anchors (first + last paragraph).
  expect(SYSTEM_PROMPT).toContain('Recovery is a journey');
  expect(SYSTEM_PROMPT).toContain(
    'gives your child the greatest opportunity for long-term recovery',
  );
  // Spanish anchors (tú register).
  expect(SYSTEM_PROMPT_ES).toContain('La recuperación es un camino');
  expect(SYSTEM_PROMPT_ES).toContain(
    'la mayor oportunidad de lograr una recuperación a largo plazo',
  );
});
