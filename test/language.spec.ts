import { test, expect } from '@playwright/test';
import { SYSTEM_PROMPT } from '../src/report/prompts/system.prompt';
import { SYSTEM_PROMPT_ES } from '../src/report/prompts/system.prompt.es';
import {
  SECTION_HEADERS_EN,
  SECTION_HEADERS_ES,
} from '../src/report/prompts/user.prompt';
import {
  ARTICLES_OF_ACTION,
  DISCUSSION_GROUPS,
  AUXILIARY_WORKSHOPS,
} from '../src/report/prompts/resources';

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';
const VALID = Array(24).fill(2) as number[];

const post = (request: any, body: unknown) =>
  request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    data: body,
  });

const getLastCaptured = async () => (await fetch(`${MOCK_BASE}/_last`)).json();

// ─── DTO validation ──────────────────────────────────────────────────────────

test('omitting language defaults to English prompt', async ({ request }) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);
  const captured = await getLastCaptured();
  expect(captured.body.messages[0].content).toBe(SYSTEM_PROMPT);
});

test('language="en" uses English system prompt', async ({ request }) => {
  const res = await post(request, { responses: VALID, language: 'en' });
  expect(res.status()).toBe(200);
  const captured = await getLastCaptured();
  expect(captured.body.messages[0].content).toBe(SYSTEM_PROMPT);
});

test('language="es" uses Spanish system prompt', async ({ request }) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);
  const captured = await getLastCaptured();
  expect(captured.body.messages[0].content).toBe(SYSTEM_PROMPT_ES);
});

test('language="fr" returns 400', async ({ request }) => {
  const res = await post(request, { responses: VALID, language: 'fr' });
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.success).toBe(false);
});

test('language=123 (non-string) returns 400', async ({ request }) => {
  const res = await post(request, { responses: VALID, language: 123 });
  expect(res.status()).toBe(400);
});

// ─── Spanish user prompt contents ────────────────────────────────────────────

test('Spanish user prompt emits Spanish section headers + Spanish framing, keeps resource titles in English', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  // Spanish section headers present
  for (const header of SECTION_HEADERS_ES) {
    expect(userContent).toContain(header);
  }
  // English section headers should NOT appear as the instructed header list
  expect(userContent).not.toContain('HEADLINE SUMMARY\nTOP 3 IMMEDIATE');

  // Spanish framing text
  expect(userContent).toMatch(/Puntajes por dominio/);
  expect(userContent).toMatch(/Top 3 dominios de prioridad/);
  expect(userContent).toMatch(/Recordatorios antes de escribir/);
  expect(userContent).toMatch(/Genera un Plan de Acción para Padres/);

  // Resource titles stay verbatim in English
  for (const title of ARTICLES_OF_ACTION) {
    expect(userContent).toContain(title);
  }
  for (const group of DISCUSSION_GROUPS) {
    expect(userContent).toContain(group);
  }
  for (const w of AUXILIARY_WORKSHOPS) {
    expect(userContent).toContain(w.title);
  }
});

test('English user prompt still uses English section headers', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'en' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  for (const header of SECTION_HEADERS_EN) {
    expect(userContent).toContain(header);
  }
  // Spanish headers should not appear in English output instructions
  expect(userContent).not.toContain('RESUMEN INICIAL');
  expect(userContent).not.toContain('PLAN DE LAS PRIMERAS 72 HORAS');
});

// ─── Spanish severity labels ─────────────────────────────────────────────────

test('Spanish prompt uses LEVE/MODERADO/GRAVE severity labels', async ({
  request,
}) => {
  // MILD-level input
  const allOnes = Array(24).fill(1);
  const res1 = await post(request, { responses: allOnes, language: 'es' });
  expect(res1.status()).toBe(200);
  const cap1 = await getLastCaptured();
  expect(cap1.body.messages[1].content).toContain('SEVERITY LEVEL: LEVE');

  // SERIOUS-level input
  const allFours = Array(24).fill(4);
  const res2 = await post(request, { responses: allFours, language: 'es' });
  expect(res2.status()).toBe(200);
  const cap2 = await getLastCaptured();
  expect(cap2.body.messages[1].content).toContain('SEVERITY LEVEL: GRAVE');

  // MODERATE baseline
  const res3 = await post(request, { responses: VALID, language: 'es' });
  expect(res3.status()).toBe(200);
  const cap3 = await getLastCaptured();
  expect(cap3.body.messages[1].content).toContain('SEVERITY LEVEL: MODERADO');
});

// ─── Spanish system prompt sanity ────────────────────────────────────────────

test('SYSTEM_PROMPT_ES holds the core ASAP rules in Spanish', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/español/i);
  expect(SYSTEM_PROMPT_ES).toMatch(/ASAP Community/);
  expect(SYSTEM_PROMPT_ES).toMatch(/regulación emocional/i);
  expect(SYSTEM_PROMPT_ES).toMatch(/alineación/i);
  expect(SYSTEM_PROMPT_ES).toMatch(/grupo de apoyo/i);
  expect(SYSTEM_PROMPT_ES).toMatch(/soft search/i);
  expect(SYSTEM_PROMPT_ES).toMatch(/LEVE/);
  expect(SYSTEM_PROMPT_ES).toMatch(/MODERADO/);
  expect(SYSTEM_PROMPT_ES).toMatch(/GRAVE/);
  // Resource-policy markers
  expect(SYSTEM_PROMPT_ES).toMatch(/Articles of Action/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Auxiliary Workshops/);
  expect(SYSTEM_PROMPT_ES).toMatch(/ASAP Discussion Groups/);
  // Titles stay in English rule
  expect(SYSTEM_PROMPT_ES).toMatch(/EXACTAMENTE en inglés/i);
  // No word "capítulo" allowed in the output — the instruction exists
  expect(SYSTEM_PROMPT_ES).toMatch(/no escribas la palabra "capítulo"/i);
});

// ─── Section-header constants uniqueness ─────────────────────────────────────

test('section-header constants are 7 unique entries in each language', () => {
  expect(SECTION_HEADERS_EN).toHaveLength(7);
  expect(SECTION_HEADERS_ES).toHaveLength(7);
  expect(new Set(SECTION_HEADERS_EN).size).toBe(7);
  expect(new Set(SECTION_HEADERS_ES).size).toBe(7);
});

// ─── Founder review pass #6 (ES) ─────────────────────────────────────────────

test('SYSTEM_PROMPT_ES has PRIVATE SEARCH hard rule with Spanish canonical sentence', () => {
  // Rule name (kept bilingual so it can be referenced consistently across passes).
  expect(SYSTEM_PROMPT_ES).toMatch(/PRIVATE SEARCH/);
  expect(SYSTEM_PROMPT_ES).toMatch(/REVISIÓN EN PRIVADO/);

  // Spanish canonical two-sentence line — both sentences must appear verbatim.
  expect(SYSTEM_PROMPT_ES).toContain(
    'Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente.',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante.',
  );

  // "mochila" must now be in the search-object list alongside cuarto + celular.
  expect(SYSTEM_PROMPT_ES).toMatch(/cuarto, la mochila o el celular/);

  // The old "cuarto o celular" anti-pattern must be replaced.
  expect(SYSTEM_PROMPT_ES).not.toMatch(
    /No revises el cuarto o el celular de tu hijo de manera confrontativa/,
  );
  expect(SYSTEM_PROMPT_ES).toMatch(
    /No revises el cuarto, la mochila o el celular de tu hijo de manera confrontativa/,
  );

  // SOFT SEARCH block header updated.
  expect(SYSTEM_PROMPT_ES).toMatch(
    /SOFT SEARCH — CÓMO PRESENTAR LA REVISIÓN DEL CUARTO \/ LA MOCHILA \/ EL CELULAR/,
  );
});

test('Spanish outgoing user prompt carries pass-#6 PRIVATE SEARCH reminder', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  // Reminder header in Spanish (with the bilingual PRIVATE SEARCH token).
  expect(userContent).toMatch(/PRIVATE SEARCH/);
  expect(userContent).toMatch(/REVISIÓN EN PRIVADO/);

  // Canonical Spanish two-sentence line shipped verbatim.
  expect(userContent).toContain(
    'Realiza cualquier revisión del cuarto, la mochila o el celular de tu hijo en privado y sin que tu hijo esté presente.',
  );
  expect(userContent).toContain(
    'Deja el cuarto tal como lo encontraste y documenta cualquier cosa relevante.',
  );
});
