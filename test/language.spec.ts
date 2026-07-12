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

  // Article-of-Action titles are NOT shipped in the directory anymore (pass #7),
  // EXCEPT where an AoA title happens to be a substring of an approved workshop
  // title (e.g., AoA "Partnering with Schools" lives inside the workshop
  // "Partnering with Schools for Your Child's Success").
  const workshopBlob = AUXILIARY_WORKSHOPS.map((w) => w.title).join(' | ');
  for (const title of ARTICLES_OF_ACTION) {
    if (workshopBlob.includes(title)) continue;
    expect(userContent).not.toContain(title);
  }
  // Approved discussion-group names appear verbatim in English
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

test('section-header constants are 8 unique entries in each language (URGENT first, then 7 base)', () => {
  // Milestone 6: the conditional URGENT CONCERN ACKNOWLEDGED header is the
  // 8th constant. It is only rendered into the user-prompt template when the
  // optional crisis field fires; the constant always exists at index 0 so
  // the parser can find it when the model emits it.
  expect(SECTION_HEADERS_EN).toHaveLength(8);
  expect(SECTION_HEADERS_ES).toHaveLength(8);
  expect(new Set(SECTION_HEADERS_EN).size).toBe(8);
  expect(new Set(SECTION_HEADERS_ES).size).toBe(8);
  expect(SECTION_HEADERS_EN[0]).toBe('URGENT CONCERN ACKNOWLEDGED');
  expect(SECTION_HEADERS_ES[0]).toBe('PREOCUPACIÓN URGENTE RECONOCIDA');
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

// ─── Founder review pass #7 (ES) ─────────────────────────────────────────────

test('SYSTEM_PROMPT_ES bans citing Articles of Action by title in the plan', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(
    /ARTICLES OF ACTION — NO LOS CITES POR TÍTULO/,
  );
  expect(SYSTEM_PROMPT_ES).toMatch(
    /cada reporte, cada nivel, sin excepciones/i,
  );
  // Resource ladder rewrite — Workshops are #1, Articles of Action no longer #1.
  expect(SYSTEM_PROMPT_ES).toMatch(
    /1\. Essential & Auxiliary Workshops — el canal primario de aprendizaje del padre/,
  );
  // Routing table no longer pairs AoA "Y Article of Action ...".
  expect(SYSTEM_PROMPT_ES).not.toMatch(/Y Article of Action "/);
  expect(SYSTEM_PROMPT_ES).not.toMatch(/O el Article of Action "/);
});

test('SYSTEM_PROMPT_ES restricts approved discussion-group set to M&I + SR', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/DISCUSSION GROUPS — LISTA APROBADA/);
  expect(SYSTEM_PROMPT_ES).toContain(
    '"Monitoring and Intervention discussion group"',
  );
  expect(SYSTEM_PROMPT_ES).toContain('"Sustaining Recovery discussion group"');
  // Every other group name appears only inside a banning context.
  const bannedGroups = [
    'Effective Communication discussion group',
    'Parent Support Forum discussion group',
    'Building a Support Network discussion group',
    'Creating Your Personal Prevention Program discussion group',
  ];
  for (const g of bannedGroups) {
    let from = 0;
    while (from < SYSTEM_PROMPT_ES.length) {
      const i = SYSTEM_PROMPT_ES.indexOf(g, from);
      if (i === -1) break;
      const window = SYSTEM_PROMPT_ES.slice(Math.max(0, i - 500), i + 500);
      expect(window).toMatch(
        /PROHIBIDO|PROHIBIDA|prohibid|nunca|NUNCA|banned|wrong/i,
      );
      from = i + 1;
    }
  }
});

test('SYSTEM_PROMPT_ES bans indirect professional-help phrasing', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/INDIRECT PROFESSIONAL-HELP PHRASING/);
  expect(SYSTEM_PROMPT_ES).toMatch(/"Empieza a prepararte para buscar"/);
  expect(SYSTEM_PROMPT_ES).toMatch(/"prepare to reach out"/);
  // The MODERATE block's prior "igual activa la secuencia" framing must be
  // replaced by the BANNED framing.
  expect(SYSTEM_PROMPT_ES).not.toMatch(
    /"Empieza a prepararte para buscar un terapeuta ASAP-endorsed" no es un sustituto parcial; la secuencia sigue aplicando\./,
  );
  expect(SYSTEM_PROMPT_ES).toMatch(
    /"Empieza a prepararte para buscar un terapeuta ASAP-endorsed" y "prepárate para acercarte a un terapeuta ASAP-endorsed" están PROHIBIDAS/,
  );
});

test('SYSTEM_PROMPT_ES enforces directory-only workshop titles', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/WORKSHOP TITLES — SOLO LOS DEL DIRECTORIO/);
  expect(SYSTEM_PROMPT_ES).toMatch(/nunca inventes un nombre de workshop/i);
});

// ─── Founder review pass #8 (ES) ─────────────────────────────────────────────

test('SYSTEM_PROMPT_ES pins "Creating a Healthy Home Environment" as AUXILIARY (not Essential)', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(
    /"Creating a Healthy Home Environment – The Power of Structure and Routine" es AUXILIARY, nunca Essential/,
  );
  // BSN must also be reaffirmed as Essential — the ES prompt previously had
  // stale "Auxiliary Workshop 'Building a Support Network'" labels.
  expect(SYSTEM_PROMPT_ES).toMatch(
    /"Building a Support Network" es ESSENTIAL, nunca Auxiliary/,
  );
  // No remaining instructional copy may still call BSN an "Auxiliary Workshop".
  expect(SYSTEM_PROMPT_ES).not.toMatch(
    /Auxiliary Workshop "Building a Support Network"/,
  );
});

test('Spanish outgoing user prompt carries pass-#8 CHHE-is-Auxiliary reminder', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  expect(userContent).toMatch(
    /"Creating a Healthy Home Environment – The Power of Structure and Routine" es AUXILIARY, nunca Essential/,
  );
});

test('Spanish outgoing user prompt carries pass-#7 reminders', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  // AoA-by-title banned reminder
  expect(userContent).toMatch(
    /NUNCA cites un Article of Action por título en el plan/,
  );
  // Approved discussion groups reminder + banned set named
  expect(userContent).toMatch(/SOLO dos están aprobados para el plan/);
  expect(userContent).toMatch(
    /PROHIBIDOS en cualquier forma: "Effective Communication discussion group"/,
  );
  // Indirect-phrasing ban shipped
  expect(userContent).toMatch(/INDIRECT PROFESSIONAL-HELP PHRASING PROHIBIDA/);
  expect(userContent).toMatch(/"Empieza a prepararte para buscar"/);
  // Workshop directory-only reminder
  expect(userContent).toMatch(/WORKSHOP TITLES — solo los del directorio/);
});

// ─── Milestone 6 — ES crisis-field, answer labels, URGENT section ──────────

test('Milestone 6 (ES): non-empty crisis auto-promotes to GRAVE in ES user prompt', async ({
  request,
}) => {
  const VALID = Array(24).fill(2) as number[];
  const res = await post(request, {
    responses: VALID,
    language: 'es',
    crisis: 'Sospecha de fentanilo en su cuarto.',
  });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;
  // ES guidance uses GRAVE (not SERIOUS) in the severity-block string.
  expect(userContent).toContain('SEVERITY LEVEL: GRAVE');
  // The Spanish context-block header.
  expect(userContent).toContain('PREOCUPACIÓN URGENTE — el padre marcó esto');
  // Crisis text echoed verbatim.
  expect(userContent).toContain('Sospecha de fentanilo en su cuarto.');
});

test('Milestone 6 (ES): user prompt template lists PREOCUPACIÓN URGENTE header when crisis fires', async ({
  request,
}) => {
  const VALID = Array(24).fill(2) as number[];
  await post(request, {
    responses: VALID,
    language: 'es',
    crisis: 'amenazas de autolesión',
  });
  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('ocho encabezados de sección');
  expect(userContent).toMatch(
    /PREOCUPACIÓN URGENTE RECONOCIDA\nRESUMEN INICIAL/,
  );
});

test('Milestone 6 (ES): user prompt template omits PREOCUPACIÓN URGENTE when no crisis', async ({
  request,
}) => {
  const VALID = Array(24).fill(2) as number[];
  await post(request, { responses: VALID, language: 'es' });
  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('siete encabezados de sección');
  expect(userContent).not.toMatch(
    /PREOCUPACIÓN URGENTE RECONOCIDA\nRESUMEN INICIAL/,
  );
});

test('Milestone 6 (ES): user prompt carries Spanish per-question answer labels', async ({
  request,
}) => {
  const responses = Array(24).fill(2);
  responses[0] = 4; // Q1 concern: ES label 3 = "Confirmado o he visto evidencia directa"
  responses[3] = 1; // Q4 strength: ES label 0 = "Rara vez o nunca"

  await post(request, { responses, language: 'es' });
  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  // Concerns block uses Spanish prefix + Spanish label.
  expect(userContent).toContain(
    'Respuesta del padre: Confirmado o he visto evidencia directa',
  );
  // Strengths block uses Spanish prefix + Spanish label.
  expect(userContent).toContain('Respuesta del padre: Rara vez o nunca');
});

test('Milestone 6 (ES): SYSTEM_PROMPT_ES has the URGENT CONCERN rule mirrored in Spanish', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/URGENT CONCERN — CAMPO OPCIONAL DE CRISIS/);
  expect(SYSTEM_PROMPT_ES).toMatch(/PREOCUPACIÓN URGENTE RECONOCIDA/);
  // Trigger-keyword resource anchors (numbers stay verbatim).
  expect(SYSTEM_PROMPT_ES).toMatch(/988 Suicide & Crisis Lifeline/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Poison Control at 1-800-222-1222/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Narcan/);
  expect(SYSTEM_PROMPT_ES).toMatch(/1-800-799-7233/);
  expect(SYSTEM_PROMPT_ES).toMatch(/2–3 oraciones cortas, calmadas/);
  expect(SYSTEM_PROMPT_ES).toMatch(/NUNCA alarmistas/);
});

test('Milestone 6 (ES): SYSTEM_PROMPT (EN) and SYSTEM_PROMPT_ES both flag the URGENT header as conditional', () => {
  // EN: emits the URGENT header "ONLY when the user message included an URGENT CONCERN block".
  expect(SYSTEM_PROMPT).toMatch(
    /ONLY when the user message included an URGENT CONCERN block/,
  );
  // ES: emits the URGENT header "Si y SOLO si ese bloque está presente".
  expect(SYSTEM_PROMPT_ES).toMatch(/Si y SOLO si ese bloque está presente/);
});

// ─── Milestone 6 polish (ES) ────────────────────────────────────────────────

test('Milestone 6 polish (ES): URGENT section has ANTI-HEDGE close rule in Spanish', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/ANTI-HEDGE en el cierre \(REGLA DURA\)/);
  expect(SYSTEM_PROMPT_ES).toMatch(/cuando te sientas listo/);
  expect(SYSTEM_PROMPT_ES).toMatch(/si te sientes lo suficientemente seguro/);
  expect(SYSTEM_PROMPT_ES).toMatch(/La acción es ahora\./);
});

test('Milestone 6 polish (ES): PERSONALIZACIÓN has ANSWER-LABEL VERBATIM BAN', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/PROHIBICIÓN DE CITAR LA ETIQUETA TEXTUAL/);
  expect(SYSTEM_PROMPT_ES).toMatch(/opciones del formulario de intake/);
  // Concrete BAD example (Spanish-localized Q17 score-4 label) must be cited.
  expect(SYSTEM_PROMPT_ES).toMatch(/Casi a diario — sin combustible/);
  // Concrete GOOD example must follow.
  expect(SYSTEM_PROMPT_ES).toMatch(
    /el agotamiento casi diario que describiste/,
  );
});

test('Milestone 6 polish (ES): extended disclaimer ban (CYA hedges) in Spanish', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/no podemos garantizar/);
  expect(SYSTEM_PROMPT_ES).toMatch(/cada situación es distinta/);
});

// ─── Founder review pass #9 (2026-05-27) — Spanish mirrors ──────────────────

test('Pass #9 (ES): SYSTEM_PROMPT_ES pairs consequences with rewards', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/REWARDS PAIRED WITH CONSEQUENCES/);
  // Canonical Spanish phrasings.
  expect(SYSTEM_PROMPT_ES).toMatch(/reglas, recompensas y consecuencias/);
  expect(SYSTEM_PROMPT_ES).toMatch(
    /expectativas claras, recompensas y consecuencias/,
  );
  // Banned bullet examples in Spanish.
  expect(SYSTEM_PROMPT_ES).toMatch(/establece consecuencias claras/);
});

test('Pass #9 (ES): SYSTEM_PROMPT_ES bans "pastillas" in favor of "sustancia desconocida"', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(
    /UNKNOWN SUBSTANCE \/ SUSTANCIA DESCONOCIDA — NUNCA "PASTILLAS"/,
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Encontraste pastillas en la mochila de tu hijo',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Encontraste una sustancia desconocida en la mochila de tu hijo',
  );
  expect(SYSTEM_PROMPT_ES).toMatch(/pastillas prensadas con fentanilo/);
});

test('Pass #9 (ES): EMOTIONAL REGULATION FIRST mirrored in every Spanish tier', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/EMOTIONAL REGULATION FIRST/);
  expect(SYSTEM_PROMPT_ES).toMatch(/REGULACIÓN EMOCIONAL PRIMERO/);
  const leveIdx = SYSTEM_PROMPT_ES.indexOf('LEVE — mayoría de 1 y 2');
  const moderadoIdx = SYSTEM_PROMPT_ES.indexOf('MODERADO — mezcla de 2 y 3');
  const graveIdx = SYSTEM_PROMPT_ES.indexOf('GRAVE — múltiples 4');
  expect(leveIdx).toBeGreaterThan(-1);
  expect(moderadoIdx).toBeGreaterThan(leveIdx);
  expect(graveIdx).toBeGreaterThan(moderadoIdx);
  const leveBlock = SYSTEM_PROMPT_ES.slice(leveIdx, moderadoIdx);
  const moderadoBlock = SYSTEM_PROMPT_ES.slice(moderadoIdx, graveIdx);
  const graveBlock = SYSTEM_PROMPT_ES.slice(
    graveIdx,
    SYSTEM_PROMPT_ES.indexOf('GRAVE — PROFUNDIDAD', graveIdx),
  );
  expect(leveBlock).toMatch(/EMOTIONAL REGULATION FIRST/);
  expect(moderadoBlock).toMatch(/EMOTIONAL REGULATION FIRST/);
  expect(graveBlock).toMatch(/EMOTIONAL REGULATION FIRST/);
});

test('Pass #9 (ES): REVIEW RESOURCES BEFORE THE CONVERSATION mirrored', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(
    /REVIEW RESOURCES BEFORE THE CONVERSATION \/ REVISAR RECURSOS ANTES DE LA CONVERSACIÓN/,
  );
  expect(SYSTEM_PROMPT_ES).toMatch(
    /Tener la información en la cabeza significa que respondes desde los hechos, no desde el miedo/,
  );
});

test('Pass #9 (ES): CONSTRUIR TU GRUPO PERSONAL DE APOYO canonical wording', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/3\. CONSTRUIR TU GRUPO PERSONAL DE APOYO/);
  expect(SYSTEM_PROMPT_ES).not.toMatch(/3\. CONSTRUIR EL GRUPO DE APOYO/);
  expect(SYSTEM_PROMPT_ES).toContain(
    "CONSTRUIR TU GRUPO PERSONAL DE APOYO — Únete y publica activamente en el 'Monitoring and Intervention discussion group.'",
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Conectar con otros padres que enfrentan retos similares',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'fuente invaluable de experiencia compartida',
  );
  // Growth-with-severity list in Spanish.
  expect(SYSTEM_PROMPT_ES).toMatch(/CRECE CON LA SEVERIDAD/);
  expect(SYSTEM_PROMPT_ES).toMatch(
    /personal escolar \(maestros, consejeros, entrenadores, decanos\)/,
  );
});

test('Pass #9 (ES): "Entiendo que" openings explicitly banned in Spanish', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/APERTURAS DIRECTAS — NO "ENTIENDO QUE"/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Entiendo que estás pasando por/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Estás pasando por/);
  expect(SYSTEM_PROMPT_ES).toMatch(/Lo que describes es/);
});

test('Pass #9 (ES): BANNED PREVENTION WORKSHOP TITLES mirrored', () => {
  expect(SYSTEM_PROMPT_ES).toMatch(/BANNED PREVENTION WORKSHOP TITLES/);
  const bannedTitles = [
    'Creating Your Personalized Prevention Plan',
    'Creating Your Personal Prevention Program',
  ];
  for (const title of bannedTitles) {
    let from = 0;
    let occurrences = 0;
    while (from < SYSTEM_PROMPT_ES.length) {
      const i = SYSTEM_PROMPT_ES.indexOf(title, from);
      if (i === -1) break;
      occurrences++;
      const window = SYSTEM_PROMPT_ES.slice(Math.max(0, i - 500), i + 500);
      expect(window).toMatch(
        /PROHIBID|prohibid|BANNED|banned|inventado|excluido|NO enrutes|nunca/i,
      );
      from = i + 1;
    }
    expect(occurrences).toBeGreaterThan(0);
  }
});

test('Pass #9 (ES): Spanish outgoing user prompt carries the new reminders', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);

  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;

  expect(userContent).toMatch(/BANNED PREVENTION WORKSHOP TITLES/);
  expect(userContent).toMatch(/REWARDS PAIRED WITH CONSEQUENCES/);
  expect(userContent).toMatch(/UNKNOWN SUBSTANCE \/ SUSTANCIA DESCONOCIDA/);
  expect(userContent).toMatch(/EMOTIONAL REGULATION FIRST — EN CADA NIVEL/);
  expect(userContent).toMatch(/REVIEW RESOURCES BEFORE THE CONVERSATION/);
  expect(userContent).toMatch(/CONSTRUIR TU GRUPO PERSONAL DE APOYO/);
  expect(userContent).toMatch(/APERTURAS DIRECTAS — NO "ENTIENDO QUE"/);
  // 4 citable Essential.
  expect(userContent).toContain('4 citables:');
});

// ─── Founder review pass #11 (ES) ─────────────────────────────────────────────

const SAMPLE_SERIOUS = [
  4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3,
];

test('pass #11 (ES): OPIOIDES ANTES QUE HEROÍNA — no parent-facing heroína default', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'OPIOIDS OVER HEROIN / OPIOIDES ANTES QUE HEROÍNA',
  );
  expect(SYSTEM_PROMPT_ES).not.toContain('sospecha de fentanilo/heroína');
  expect(SYSTEM_PROMPT_ES).toContain(
    'admitió haber usado opioides, fentanilo u otra droga que puede causar daño grave',
  );
});

test('pass #11 (ES): gender-neutral regulation label applies to every report incl CRÍTICO', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'aplica en cada sección y en cada reporte, incluido el reporte URGENT / de crisis (CRÍTICO)',
  );
});

test('pass #11 (ES): COMPLETE ROOM SEARCH for GRAVE + CRÍTICO', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'COMPLETE ROOM SEARCH — MODERADO, GRAVE Y CRÍTICO (REGLA DURA',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Esto es una misión de recolección de hechos, no un castigo.',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'documéntalas, confíscalas y deséchalas de forma segura',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'Auxiliary Workshop "How and When to Search a Room"',
  );
});

test('pass #11 (ES): GRAVE user prompt carries REGLA DURA 11 complete search', async ({
  request,
}) => {
  const res = await post(request, {
    responses: SAMPLE_SERIOUS,
    language: 'es',
  });
  expect(res.status()).toBe(200);
  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('REGLA DURA 11 (COMPLETE ROOM SEARCH');
  expect(userContent).toContain(
    'documéntalas, confíscalas y deséchalas de forma segura',
  );
  expect(userContent).not.toContain('sospecha de fentanilo/heroína');
});

// ─── Founder review pass #12 (ES) ─────────────────────────────────────────────

test('pass #12 (ES): MODERADO joins complete room search; soft search LEVE-only', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'COMPLETE ROOM SEARCH — MODERADO, GRAVE Y CRÍTICO',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'El encuadre de soft search de arriba es solo para reportes LEVE.',
  );
});

test('pass #12 (ES): ROOT CAUSE — entender el porqué (cierre MODERADO/GRAVE/CRÍTICO)', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'ROOT CAUSE — ENTENDER EL PORQUÉ (REGLA DURA',
  );
  expect(SYSTEM_PROMPT_ES).toContain(
    'el objetivo último es entender POR QUÉ el hijo está consumiendo',
  );
});

test('pass #12 (ES): MODERADO user prompt carries complete search + root cause', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, language: 'es' });
  expect(res.status()).toBe(200);
  const captured = await getLastCaptured();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain(
    'MODERADO ahora usa la revisión completa del cuarto',
  );
  expect(userContent).toContain('ROOT CAUSE — ENTENDER EL PORQUÉ');
  // Beta item 1: root cause is now delivered via the standardized closing.
  expect(userContent).toContain('STANDARDIZED CLOSING');
});

// ─── Beta Finalization item 1: standardized "Protecting Recovery" closing ─────
// Founder-approved (Beta Finalization scope).

test('Beta item 1: standardized closing rule + resources wired (EN)', () => {
  expect(DISCUSSION_GROUPS).toContain('Protecting Recovery');
  expect(AUXILIARY_WORKSHOPS.map((w) => w.title)).toContain(
    'Protecting Recovery: Preventing Relapse and Responding to Setbacks',
  );
  expect(SYSTEM_PROMPT).toContain('STANDARDIZED CLOSING — PROTECTING RECOVERY');
  // Founder-provided text present verbatim (first + last paragraph anchors).
  expect(SYSTEM_PROMPT).toContain('Recovery is a journey');
  expect(SYSTEM_PROMPT).toContain('Protecting Recovery Discussion Group');
  // Not offered in MILD.
  expect(SYSTEM_PROMPT).toMatch(/MILD reports do NOT include it/);
  // "early warning signs" is exempted from the SERIOUS awareness-framing ban here.
  expect(SYSTEM_PROMPT).toMatch(
    /EXEMPT from the SERIOUS awareness-framing ban/,
  );
});

test('Beta item 1: standardized closing rule + verbatim ES text wired (ES)', () => {
  expect(SYSTEM_PROMPT_ES).toContain(
    'STANDARDIZED CLOSING — PROTECTING RECOVERY',
  );
  // Spanish register is tú, and the workshop/group titles stay in English verbatim.
  expect(SYSTEM_PROMPT_ES).toContain('La recuperación es un camino');
  expect(SYSTEM_PROMPT_ES).toContain(
    'Protecting Recovery: Preventing Relapse and Responding to Setbacks',
  );
  expect(SYSTEM_PROMPT_ES).toContain('Protecting Recovery Discussion Group');
  expect(SYSTEM_PROMPT_ES).toMatch(/los reportes LEVE NO lo incluyen/);
});
