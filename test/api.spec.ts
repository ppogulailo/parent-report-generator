import { test, expect } from '@playwright/test';
import * as http from 'http';
import { spawn } from 'child_process';
import { SYSTEM_PROMPT } from '../src/report/prompts/system.prompt';
import {
  ARTICLES_OF_ACTION,
  AUXILIARY_WORKSHOPS,
  DISCUSSION_GROUPS,
  ESSENTIAL_WORKSHOPS,
} from '../src/report/prompts/resources';

const KEY = 'test-secret';
const MOCK_BASE = 'http://localhost:4001';
const VALID = Array(24).fill(2) as number[];
const SAMPLE = [
  4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3,
];

const post = (request: any, body: unknown, apiKey: string | null = KEY) =>
  request.post('/api/report/generate', {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey !== null ? { 'X-API-Key': apiKey } : {}),
    },
    data: body,
  });

// ─── Health ───────────────────────────────────────────────────────────────────

test('GET /api/health returns 200', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('GET /api/health requires no API key', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('missing X-API-Key returns 401', async ({ request }) => {
  const res = await request.post('/api/report/generate', {
    headers: { 'Content-Type': 'application/json' },
    data: { responses: VALID },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(typeof body.error).toBe('string');
});

test('wrong X-API-Key returns 401', async ({ request }) => {
  const res = await post(request, { responses: VALID }, 'wrong-key');
  expect(res.status()).toBe(401);
});

test('correct key with invalid body returns 400 not 401', async ({
  request,
}) => {
  const res = await post(request, { responses: [] });
  expect(res.status()).toBe(400);
});

// ─── Validation ───────────────────────────────────────────────────────────────

const invalidCases: Array<[string, unknown]> = [
  ['missing responses key', {}],
  ['responses is not an array', { responses: 'not-an-array' }],
  ['responses has 23 items', { responses: Array(23).fill(2) }],
  ['responses has 25 items', { responses: Array(25).fill(2) }],
  ['responses contains float', { responses: [...Array(23).fill(2), 2.5] }],
  ['responses contains string', { responses: [...Array(23).fill(2), '3'] }],
  ['responses contains 0', { responses: [...Array(23).fill(2), 0] }],
  ['responses contains 5', { responses: [...Array(23).fill(2), 5] }],
  ['responses is empty array', { responses: [] }],
  ['responses contains null', { responses: [...Array(23).fill(2), null] }],
];

for (const [label, body] of invalidCases) {
  test(`400 when ${label}`, async ({ request }) => {
    const res = await post(request, body);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(typeof json.error).toBe('string');
    expect(json.error.length).toBeGreaterThan(0);
  });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

test('all 5 domain scores are calculated correctly for sample input', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);
  const { domainScores } = await res.json();
  expect(domainScores['Immediate Safety & Urgency']).toBeCloseTo(3.6, 2);
  expect(domainScores['Household Structure']).toBeCloseTo(2.0, 2);
  expect(domainScores['Boundary Consistency']).toBeCloseTo(2.2, 2);
  expect(domainScores['Communication & Conflict']).toBeCloseTo(3.0, 2);
  expect(domainScores['Support & Professional Engagement']).toBeCloseTo(3.0, 2);
});

test('top domain for sample input is Immediate Safety & Urgency', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
});

test('topDomains always has exactly 3 entries', async ({ request }) => {
  const res = await post(request, { responses: SAMPLE });
  const { topDomains } = await res.json();
  expect(topDomains).toHaveLength(3);
});

test('tie-breaking: all-equal input puts Safety & Urgency first', async ({
  request,
}) => {
  const res = await post(request, { responses: Array(24).fill(2) });
  const { topDomains } = await res.json();
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
});

test('tie-breaking: Communication & Conflict beats Boundary on tie', async ({
  request,
}) => {
  // Build a payload where Communication & Conflict and Boundary Consistency
  // both average exactly 3, and Safety averages 4 (top), so Communication
  // must be #2 ahead of Boundary per TIE_BREAK_ORDER.
  const r = Array(24).fill(2);
  // Safety: Q1,2,10,23,24 → indices 0,1,9,22,23
  for (const i of [0, 1, 9, 22, 23]) r[i] = 4;
  // Communication & Conflict: Q3,5,6,9,13 → 2,4,5,8,12
  for (const i of [2, 4, 5, 8, 12]) r[i] = 3;
  // Boundary Consistency: Q7,11,18,19,22 → 6,10,17,18,21
  for (const i of [6, 10, 17, 18, 21]) r[i] = 3;

  const res = await post(request, { responses: r });
  const { domainScores, topDomains } = await res.json();
  expect(domainScores['Communication & Conflict']).toBeCloseTo(3.0, 2);
  expect(domainScores['Boundary Consistency']).toBeCloseTo(3.0, 2);
  expect(topDomains[0]).toBe('Immediate Safety & Urgency');
  expect(topDomains[1]).toBe('Communication & Conflict');
  expect(topDomains[2]).toBe('Boundary Consistency');
});

// ─── Response Shape ───────────────────────────────────────────────────────────

const DOMAIN_NAMES = [
  'Immediate Safety & Urgency',
  'Household Structure',
  'Boundary Consistency',
  'Communication & Conflict',
  'Support & Professional Engagement',
];

// Milestone 6 added urgentConcern as the conditional 8th section. It is
// always present on the parsed shape, but is the empty string in any plan
// where the optional crisis field was not supplied (the model never emits
// the URGENT CONCERN ACKNOWLEDGED header in that case).
const REPORT_KEYS_ALWAYS_NON_EMPTY = [
  'headlineSummary',
  'topImmediatePriorities',
  'keyPriorities',
  'whatToAvoid',
  'first72Hours',
  'days4to7',
  'encouragement',
];

test('success response has correct shape', async ({ request }) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);

  const body = await res.json();

  expect(body.success).toBe(true);

  expect(Object.keys(body.domainScores)).toHaveLength(5);
  for (const name of DOMAIN_NAMES) {
    expect(body.domainScores[name]).toBeDefined();
    expect(body.domainScores[name]).toBeGreaterThanOrEqual(1);
    expect(body.domainScores[name]).toBeLessThanOrEqual(4);
  }

  expect(body.topDomains).toHaveLength(3);
  for (const d of body.topDomains) {
    expect(DOMAIN_NAMES).toContain(d);
  }

  expect(Object.keys(body.report)).toHaveLength(8);
  // urgentConcern is a string but is empty when no crisis field was supplied.
  expect(typeof body.report.urgentConcern).toBe('string');
  for (const key of REPORT_KEYS_ALWAYS_NON_EMPTY) {
    expect(typeof body.report[key]).toBe('string');
    expect(body.report[key].length).toBeGreaterThan(0);
  }
});

// ─── Outgoing Prompt ──────────────────────────────────────────────────────────

test('outgoing OpenAI request uses verbatim SYSTEM_PROMPT and includes scores + top 3', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  expect(captured).not.toBeNull();
  expect(captured.headers['authorization']).toBe('Bearer mock-key');

  const { body } = captured;
  expect(body.model).toBe('gpt-4o-mini');

  expect(Array.isArray(body.messages)).toBe(true);
  expect(body.messages).toHaveLength(2);
  expect(body.messages[0].role).toBe('system');
  expect(body.messages[0].content).toBe(SYSTEM_PROMPT);
  expect(body.messages[1].role).toBe('user');

  const userContent: string = body.messages[1].content;
  // All 5 domain names + numeric values rounded to 2dp must be present
  expect(userContent).toContain('Immediate Safety & Urgency: 3.60');
  expect(userContent).toContain('Household Structure: 2.00');
  expect(userContent).toContain('Boundary Consistency: 2.20');
  expect(userContent).toContain('Communication & Conflict: 3.00');
  expect(userContent).toContain('Support & Professional Engagement: 3.00');
  // Top 3 list must appear, with Safety first
  expect(userContent).toContain('Top 3 Priority Domains:');
  expect(userContent).toMatch(
    /Top 3 Priority Domains:\s*Immediate Safety & Urgency,/,
  );
  // Per-question context: SAMPLE has Q1=4, Q3=4, Q9=4, Q17=4, Q23=4 as strong concerns
  expect(userContent).toContain('Strong concerns (scored 4');
  expect(userContent).toContain(
    'How certain are you that your child has used drugs',
  );
  expect(userContent).toContain('mood swings, withdrawal, or aggressive');
  // New 7-section header list
  expect(userContent).toContain('TOP 3 IMMEDIATE PRIORITIES');
  expect(userContent).toContain('FIRST 72 HOURS PLAN');
  expect(userContent).toContain('DAYS 4 TO 7 CONTINUATION');
});

// ─── System Prompt Content (Matthew refinements) ─────────────────────────────

test('SYSTEM_PROMPT reflects Matthew refinements', () => {
  // 1. Headline intuition + expanded signals
  expect(SYSTEM_PROMPT).toMatch(/parental intuition/i);
  expect(SYSTEM_PROMPT).toMatch(/declining grades/i);
  expect(SYSTEM_PROMPT).toMatch(/strained relationships/i);

  // 2. Priority order: regulation → alignment → support → THEN conversation.
  // Anchor on the numbered bullet headers so unrelated in-prompt mentions
  // of these phrases (e.g. routing rules referring to "BUILD THE SUPPORT GROUP")
  // do not shadow the actual section anchors.
  const regIdx = SYSTEM_PROMPT.indexOf('1. PARENT EMOTIONAL REGULATION');
  const alignIdx = SYSTEM_PROMPT.indexOf('2. CO-PARENT / CAREGIVER ALIGNMENT');
  const supportIdx = SYSTEM_PROMPT.indexOf('3. BUILD THE SUPPORT GROUP');
  expect(regIdx).toBeGreaterThan(-1);
  expect(alignIdx).toBeGreaterThan(regIdx);
  expect(supportIdx).toBeGreaterThan(alignIdx);
  expect(SYSTEM_PROMPT).toMatch(
    /conversation with the child comes AFTER these three/i,
  );

  // 3. Soft search framing (not "don't search").
  // Pass #6 rewrote the bullets in stronger terms — "WITHOUT THE CHILD
  // PRESENT" replaced "without the child's knowledge"; "document anything
  // relevant" replaced "document it". Either form of the privacy clause is
  // acceptable as long as the rule itself is still present.
  expect(SYSTEM_PROMPT).toMatch(/soft search/i);
  expect(SYSTEM_PROMPT).toMatch(
    /without the child's knowledge|without your child present|WITHOUT THE CHILD PRESENT/i,
  );
  expect(SYSTEM_PROMPT).toMatch(/room is left exactly as it was found/i);
  expect(SYSTEM_PROMPT).toMatch(
    /document it, then remove it|document anything relevant, then remove it/i,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /boundary, not a punishment|boundary, not as punishment|clear boundary, not a punishment/i,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /BEFORE the initial conversation|before the initial conversation/i,
  );

  // 4. 72-hour plan sequencing
  const d1 = SYSTEM_PROMPT.indexOf(
    'DAY 1 — EMOTIONAL REGULATION + CO-PARENT ALIGNMENT',
  );
  const d2 = SYSTEM_PROMPT.indexOf(
    'DAY 2 — BUILD THE SUPPORT GROUP + GATHER INFORMATION',
  );
  const d3 = SYSTEM_PROMPT.indexOf('DAY 3 — PREPARE FOR THE CONVERSATION');
  expect(d1).toBeGreaterThan(-1);
  expect(d2).toBeGreaterThan(d1);
  expect(d3).toBeGreaterThan(d2);

  // Natural conversation tone guidance present
  expect(SYSTEM_PROMPT).toMatch(/not scripted/i);
  expect(SYSTEM_PROMPT).toMatch(
    /parent \+ child vs (the problem|the substance use)/i,
  );

  // 5. Articles of Action — pass #7 banned them as parent-facing
  // recommendations. The term must still appear in the prompt (inside the
  // hard rule that bans it), but no "Chapter N" citations.
  expect(SYSTEM_PROMPT).toMatch(/Articles of Action/);
  expect(SYSTEM_PROMPT).toMatch(/DO NOT CITE BY TITLE/);
  expect(SYSTEM_PROMPT).not.toMatch(/Chapter\s+\d+/);
  expect(SYSTEM_PROMPT).not.toMatch(/Articles of Action,?\s*Chapter/i);

  // 6. ASAP Discussion Groups — pass #7 narrowed to two approved groups
  // and reframed the descriptor as "live peer-support mechanism".
  expect(SYSTEM_PROMPT).toMatch(/ASAP Discussion Group/);
  expect(SYSTEM_PROMPT).toMatch(
    /live peer-support mechanism|JOIN AND ACTIVELY POST|approved Discussion Groups/i,
  );
  expect(SYSTEM_PROMPT).toMatch(/JOIN AND ACTIVELY POST/);

  // 7. Auxiliary workshops referenced by exact title
  expect(SYSTEM_PROMPT).toMatch(/Auxiliary Workshop/);
  expect(SYSTEM_PROMPT).toMatch(/exact title/i);
});

// ─── Tone refinement: AI-coaching filler banned in MILD + overall ─────────────

test('SYSTEM_PROMPT bans AI-coaching filler phrases by name', () => {
  // The prompt must explicitly list these as banned so the model stops using them.
  expect(SYSTEM_PROMPT).toMatch(/take a moment/i);
  expect(SYSTEM_PROMPT).toMatch(/this is a good time/i);
  expect(SYSTEM_PROMPT).toMatch(/it's important to/i);
  expect(SYSTEM_PROMPT).toMatch(/breathe deeply|take a deep breath/i);
  expect(SYSTEM_PROMPT).toMatch(/be mindful of|allow yourself to/i);

  // The ban must be framed as a rule, not as acceptable language.
  expect(SYSTEM_PROMPT).toMatch(/AI-coaching filler|polite AI|self-help book/i);
});

test('SYSTEM_PROMPT includes the "frustrated, angry, and unsure" direct-tone example', () => {
  // Matthew's founder-level example — baked in so the model has a concrete template.
  expect(SYSTEM_PROMPT).toMatch(/frustrated, angry, and unsure/i);
  expect(SYSTEM_PROMPT).toMatch(
    /can't be in the driver's seat|can't be in control/i,
  );
  expect(SYSTEM_PROMPT).toMatch(/step away.{0,40}come back steady/i);
});

test('SYSTEM_PROMPT MILD block demands direct emotional honesty, not polished coaching', () => {
  const mildIdx = SYSTEM_PROMPT.indexOf('MILD — mostly 1s and 2s');
  expect(mildIdx).toBeGreaterThan(-1);
  const moderateIdx = SYSTEM_PROMPT.indexOf('MODERATE — a mix');
  expect(moderateIdx).toBeGreaterThan(mildIdx);

  const mildBlock = SYSTEM_PROMPT.slice(mildIdx, moderateIdx);
  // Must explicitly warn against the wellness-coach drift.
  expect(mildBlock).toMatch(/polished|polite|sanitized|wellness-coach/i);
  // Must give the model permission to name frustration / uncertainty.
  expect(mildBlock).toMatch(/frustration|uncertainty|doubt/i);
  expect(mildBlock).toMatch(/second-guess/i);
  // Must keep the "not a crisis" guardrail.
  expect(mildBlock).toMatch(/NOT urgent|not a crisis|NOT catastrophizing/i);
});

test('SYSTEM_PROMPT has explicit HONESTY OVER POLISH rule', () => {
  expect(SYSTEM_PROMPT).toMatch(/HONESTY OVER POLISH/);
  expect(SYSTEM_PROMPT).toMatch(/frustration, anger, fear, exhaustion/i);
});

// ─── Tone refinement round 2: decisive + normalize ───────────────────────────

test('SYSTEM_PROMPT prefers decisive language over suggestive hedging', () => {
  expect(SYSTEM_PROMPT).toMatch(/DECISIVE LANGUAGE/);
  // The "worth taking seriously" → "need to be taken seriously" rewrite.
  expect(SYSTEM_PROMPT).toMatch(/need to be taken seriously/i);

  // The phrase "worth taking seriously" is allowed INSIDE the DECISIVE
  // LANGUAGE rule (it's the hedge being banned + the BAD example), but
  // must not appear anywhere else as instructional copy.
  const ruleStart = SYSTEM_PROMPT.indexOf('DECISIVE LANGUAGE');
  const ruleEnd = SYSTEM_PROMPT.indexOf('NORMALIZE AFTER NAMING');
  expect(ruleStart).toBeGreaterThan(-1);
  expect(ruleEnd).toBeGreaterThan(ruleStart);
  const before = SYSTEM_PROMPT.slice(0, ruleStart);
  const after = SYSTEM_PROMPT.slice(ruleEnd);
  expect(before).not.toMatch(/worth taking seriously/i);
  expect(after).not.toMatch(/worth taking seriously/i);
});

test('SYSTEM_PROMPT requires normalize-after-naming for feelings', () => {
  expect(SYSTEM_PROMPT).toMatch(/NORMALIZE AFTER NAMING/);
  expect(SYSTEM_PROMPT).toMatch(/name → normalize → direct it/i);
  // Founder's exact example, baked in as a template.
  expect(SYSTEM_PROMPT).toMatch(
    /confusion and frustration — and that's normal/,
  );
});

test('PARENT EMOTIONAL REGULATION bullet enforces normalize step', () => {
  const idx = SYSTEM_PROMPT.indexOf('PARENT EMOTIONAL REGULATION');
  const next = SYSTEM_PROMPT.indexOf('CO-PARENT / CAREGIVER ALIGNMENT', idx);
  expect(idx).toBeGreaterThan(-1);
  expect(next).toBeGreaterThan(idx);
  const bullet = SYSTEM_PROMPT.slice(idx, next);
  expect(bullet).toMatch(/normalize/i);
  expect(bullet).toMatch(/that's normal/i);
  expect(bullet).toMatch(/decisive/i);
});

// ─── ASAP Resource Directory (16 / 6 / 5 / 20 lists) ──────────────────────────

test('resource directory module exposes the correct counts', () => {
  // Pass #7 narrowed the approved discussion-group set to two: M&I and SR.
  // The Articles-of-Action data array stays at 16 (for historical / topical
  // reference) but is no longer rendered into the parent-facing directory.
  expect(ARTICLES_OF_ACTION).toHaveLength(16);
  expect(DISCUSSION_GROUPS).toHaveLength(2);
  expect(DISCUSSION_GROUPS).toEqual([
    'Monitoring and Intervention',
    'Sustaining Recovery',
  ]);
  expect(ESSENTIAL_WORKSHOPS).toHaveLength(5);
  expect(AUXILIARY_WORKSHOPS).toHaveLength(20);
});

test('Essential Workshops list matches founder canon', () => {
  const titles = ESSENTIAL_WORKSHOPS.map((w) => w.title);
  expect(titles).toEqual([
    'Creating Your Personalized Prevention Plan',
    'Effective Communication: Building Trust and Engagement with Your Teen',
    'Monitoring and Intervention: Knowing When and How to Step In',
    'Building a Support Network',
    'Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment',
  ]);
});

test('Building a Support Network is Essential, not Auxiliary', () => {
  const essentialTitles = ESSENTIAL_WORKSHOPS.map((w) => w.title);
  const auxiliaryTitles = AUXILIARY_WORKSHOPS.map((w) => w.title);
  expect(essentialTitles).toContain('Building a Support Network');
  expect(auxiliaryTitles).not.toContain('Building a Support Network');
});

test('resource titles are unique', () => {
  expect(new Set(ARTICLES_OF_ACTION).size).toBe(ARTICLES_OF_ACTION.length);
  expect(new Set(DISCUSSION_GROUPS).size).toBe(DISCUSSION_GROUPS.length);
  expect(new Set(ESSENTIAL_WORKSHOPS.map((w) => w.title)).size).toBe(
    ESSENTIAL_WORKSHOPS.length,
  );
  expect(new Set(AUXILIARY_WORKSHOPS.map((w) => w.title)).size).toBe(
    AUXILIARY_WORKSHOPS.length,
  );
});

test('outgoing user prompt ships only the approved parent-facing resources', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Directory header — Articles-of-Action section is GONE (pass #7), and the
  // discussion-group list is narrowed to the 2 approved groups.
  expect(userContent).toContain('ASAP RESOURCE DIRECTORY');
  expect(userContent).not.toContain('Articles of Action (16 total');
  expect(userContent).toContain('ASAP Discussion Groups (2 approved');
  expect(userContent).toContain('Essential Workshops (5 total');
  expect(userContent).toContain('Auxiliary Workshops (20 total');

  // The directory must NOT render any Article-of-Action title verbatim
  // (the data array still exists in code but is not parent-facing).
  // We filter out titles that happen to be substrings of approved workshop
  // titles (e.g., the AoA "Partnering with Schools" is a substring of the
  // workshop "Partnering with Schools for Your Child's Success").
  const workshopBlob = [
    ...ESSENTIAL_WORKSHOPS.map((w) => w.title),
    ...AUXILIARY_WORKSHOPS.map((w) => w.title),
  ].join(' | ');
  for (const title of ARTICLES_OF_ACTION) {
    if (workshopBlob.includes(title)) continue;
    expect(userContent).not.toContain(title);
  }
  // Every approved discussion group appears verbatim
  for (const group of DISCUSSION_GROUPS) {
    expect(userContent).toContain(group);
  }
  // Every Essential workshop title + summary appears verbatim
  for (const w of ESSENTIAL_WORKSHOPS) {
    expect(userContent).toContain(w.title);
    expect(userContent).toContain(w.summary);
  }
  // Every Auxiliary workshop title + summary appears verbatim
  for (const w of AUXILIARY_WORKSHOPS) {
    expect(userContent).toContain(w.title);
    expect(userContent).toContain(w.summary);
  }

  // Reminder requires exact-title usage
  expect(userContent).toMatch(/full exact title/i);
  // Banned-group reminder must be present in the directory
  expect(userContent).toMatch(/BANNED discussion group names/);
});

test('outgoing user prompt carries the new sequencing + resource order', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Resource order reminder still mentions Discussion Groups (the approved 2)
  expect(userContent).toMatch(/ASAP Discussion Groups/);
  expect(userContent).toMatch(/PRIMARY support mechanism/);
  expect(userContent).toMatch(/soft search/i);

  // Ordering sequence for the 72-hour plan appears in the reminder
  expect(userContent).toMatch(
    /Day 1 = emotional regulation \+ co-parent alignment/i,
  );
  expect(userContent).toMatch(
    /Day 2 = build support group \+ gather information/i,
  );
  expect(userContent).toMatch(
    /Day 3 = prepare for the first real conversation/i,
  );

  // The user prompt must not cite any "Chapter N" or "Articles of Action, Chapter ..." reference
  expect(userContent).not.toMatch(/Chapter\s+\d+/);
  expect(userContent).not.toMatch(/Articles of Action,?\s*Chapter/i);
});

// ─── Founder review pass #4 ───────────────────────────────────────────────────

test('SYSTEM_PROMPT replaces "For deeper insights" with the new "For guidance, consider posting" lead-in', () => {
  // The new canonical professional-help lead-in must appear at least once.
  expect(SYSTEM_PROMPT).toMatch(
    /For guidance, consider posting questions in the Sustaining Recovery discussion group\./,
  );

  // The old lead-in must only appear inside an explicit ban — never as
  // instructional / example copy. Every remaining occurrence should be
  // adjacent to a banning verb.
  const oldLeadIn =
    "For deeper insights, reach out to the 'Sustaining Recovery discussion group.'";
  const occurrences: number[] = [];
  let from = 0;
  while (from < SYSTEM_PROMPT.length) {
    const i = SYSTEM_PROMPT.indexOf(oldLeadIn, from);
    if (i === -1) break;
    occurrences.push(i);
    from = i + 1;
  }
  for (const i of occurrences) {
    // The surrounding 200-char window must contain a banning verb.
    const window = SYSTEM_PROMPT.slice(Math.max(0, i - 200), i + 200);
    expect(window).toMatch(/BANNED|banned|prohibit|now removed|prior wording/i);
  }
});

test('SYSTEM_PROMPT has explicit TRUSTED ADULT hard rule banning generic recommendations', () => {
  expect(SYSTEM_PROMPT).toMatch(/TRUSTED ADULT/);
  // The exact founder-cited bans
  expect(SYSTEM_PROMPT).toMatch(
    /Reach out to at least one trusted adult who can support your child/i,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /Identify one trusted adult to confide in about your concerns/i,
  );
  // Child-network advice must be routed to the Building a Support Network workshop.
  // Pass #7 reworded the relevant line — match either ordering of the
  // workshop name and the exclusivity marker.
  expect(SYSTEM_PROMPT).toMatch(
    /Building a Support Network[^.]*exclusive|exclusive[^.]*Building a Support Network|EXCLUSIVE[^.]*Building a Support Network/i,
  );
  // School engagement called out as a key component
  expect(SYSTEM_PROMPT).toMatch(/engaging schools|school engagement/i);
});

test('BUILD THE SUPPORT GROUP bullet is exclusively about the parent', () => {
  const start = SYSTEM_PROMPT.indexOf('3. BUILD THE SUPPORT GROUP');
  const end = SYSTEM_PROMPT.indexOf(
    'The conversation with the child comes AFTER these three',
  );
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const bullet = SYSTEM_PROMPT.slice(start, end);

  // The bullet must explicitly scope itself to the parent.
  expect(bullet).toMatch(/EXCLUSIVELY about the parent/i);
  expect(bullet).toMatch(/NEVER ABOUT THE CHILD/i);

  // Banned child-network phrasings must be called out as banned.
  expect(bullet).toMatch(/surrounding the child with trusted adults/i);
  expect(bullet).toMatch(/identifying a trusted adult to confide in/i);

  // The bullet must NOT instruct the parent to surround the child with
  // trusted people (the prior wording).
  expect(bullet).not.toMatch(
    /surround the child with trusted people and surround yourself/i,
  );
});

test('CO-PARENT / DAY 1 / DAY 2 no longer rely on "trusted adult" as a co-parent surrogate', () => {
  // TOP 3 #2 uses the family-side phrasing instead of "trusted adult".
  const coParentStart = SYSTEM_PROMPT.indexOf(
    '2. CO-PARENT / CAREGIVER ALIGNMENT',
  );
  const coParentEnd = SYSTEM_PROMPT.indexOf(
    '3. BUILD THE SUPPORT GROUP',
    coParentStart,
  );
  const coParent = SYSTEM_PROMPT.slice(coParentStart, coParentEnd);
  expect(coParent).toMatch(/another parent or guardian on the family side/i);
  // "trusted adult" inside this bullet must appear only inside the cross-reference to the hard rule.
  expect(coParent).toMatch(/TRUSTED ADULT hard rule/);

  // DAY 1 same: parenthetical no longer says "or trusted adult".
  const d1Start = SYSTEM_PROMPT.indexOf(
    'DAY 1 — EMOTIONAL REGULATION + CO-PARENT ALIGNMENT',
  );
  const d1End = SYSTEM_PROMPT.indexOf(
    'DAY 2 — BUILD THE SUPPORT GROUP + GATHER INFORMATION',
  );
  const d1 = SYSTEM_PROMPT.slice(d1Start, d1End);
  expect(d1).not.toMatch(/\(or trusted adult\)/i);
  expect(d1).toMatch(/another parent or guardian on the family side/i);

  // DAY 2 must NOT start with "Identify one trusted adult to call".
  const d2Start = SYSTEM_PROMPT.indexOf(
    'DAY 2 — BUILD THE SUPPORT GROUP + GATHER INFORMATION',
  );
  const d2End = SYSTEM_PROMPT.indexOf('DAY 3 — PREPARE FOR THE CONVERSATION');
  const d2 = SYSTEM_PROMPT.slice(d2Start, d2End);
  expect(d2).not.toMatch(/Identify one trusted adult to call/i);
  // DAY 2 must explicitly call out M&I as the peer-support step.
  expect(d2).toMatch(/Monitoring and Intervention discussion group/);
});

test('outgoing user prompt carries the pass-#4 reminders', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // New canonical professional-help sequence lead-in is present.
  expect(userContent).toMatch(
    /For guidance, consider posting questions in the Sustaining Recovery discussion group/,
  );

  // The TRUSTED ADULT reminder is present.
  expect(userContent).toMatch(/TRUSTED ADULT/);
  expect(userContent).toMatch(/banned generic/i);

  // BUILD THE SUPPORT GROUP scoping reminder is present.
  expect(userContent).toMatch(
    /EXCLUSIVELY about the parent['’]s own peer support/i,
  );
});

// ─── Founder review pass #5 ───────────────────────────────────────────────────

test('SYSTEM_PROMPT has NO PLACEHOLDERS hard rule with banned placeholder phrases', () => {
  expect(SYSTEM_PROMPT).toMatch(/NO PLACEHOLDERS/);
  // The exact placeholder text the founder saw in a Serious report must be
  // listed in the banned-phrases set so the model recognizes and avoids it.
  expect(SYSTEM_PROMPT).toMatch(/Add the two-sentence sequence here/);
  expect(SYSTEM_PROMPT).toMatch(/Insert the professional help sequence/i);
  // The rule must mandate writing both sentences in full every time.
  expect(SYSTEM_PROMPT).toMatch(/verbatim, in order|in full, verbatim/i);
  expect(SYSTEM_PROMPT).toMatch(/literal output|never a referenced label/i);
});

test('SYSTEM_PROMPT codifies Essential vs Auxiliary workshop categories', () => {
  // Both categories must be named with their counts.
  expect(SYSTEM_PROMPT).toMatch(/5 Essential Workshops/);
  expect(SYSTEM_PROMPT).toMatch(/20 Auxiliary Workshops/);
  // The 5 Essential titles must all appear by exact name.
  expect(SYSTEM_PROMPT).toContain('Creating Your Personalized Prevention Plan');
  expect(SYSTEM_PROMPT).toContain(
    'Effective Communication: Building Trust and Engagement with Your Teen',
  );
  expect(SYSTEM_PROMPT).toContain(
    'Monitoring and Intervention: Knowing When and How to Step In',
  );
  expect(SYSTEM_PROMPT).toContain(
    'Sustaining Recovery: Parental Oversight and Support for Adolescents Post-Treatment',
  );
  // BSN is classified as Essential, not Auxiliary.
  expect(SYSTEM_PROMPT).toMatch(/"Building a Support Network" is an ESSENTIAL/);
  // The citation label format is taught.
  expect(SYSTEM_PROMPT).toMatch(/Essential Workshop "X"/);
  expect(SYSTEM_PROMPT).toMatch(/Auxiliary Workshop "X"/);
});

test('SYSTEM_PROMPT no longer cites BSN as an Auxiliary Workshop', () => {
  // Every "Auxiliary Workshop" mention of BSN should be gone, EXCEPT for
  // the wrong-label warning that explicitly tells the model not to use it.
  const occurrences: number[] = [];
  let from = 0;
  while (from < SYSTEM_PROMPT.length) {
    const i = SYSTEM_PROMPT.indexOf('Auxiliary Workshop', from);
    if (i === -1) break;
    occurrences.push(i);
    from = i + 1;
  }
  for (const i of occurrences) {
    const slice = SYSTEM_PROMPT.slice(i, i + 80);
    if (slice.includes('Building a Support Network')) {
      // Must be wrapped in a banning / warning context (the one allowed mention).
      const window = SYSTEM_PROMPT.slice(Math.max(0, i - 120), i + 200);
      expect(window).toMatch(/wrong|never cite|labeling error|not Auxiliary/i);
    }
  }
});

test('outgoing user prompt carries the pass-#5 directory and reminders', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Essential Workshops list ships in the directory.
  expect(userContent).toContain('Essential Workshops (5 total');
  expect(userContent).toContain('Auxiliary Workshops (20 total');

  // NO PLACEHOLDERS reminder is present.
  expect(userContent).toMatch(/NO PLACEHOLDERS/);
  expect(userContent).toMatch(/Add the two-sentence sequence here/);

  // WORKSHOP CATEGORIES reminder is present.
  expect(userContent).toMatch(/WORKSHOP CATEGORIES/);
  expect(userContent).toMatch(/"Building a Support Network" is ESSENTIAL/);
});

// ─── Founder review pass #6 ───────────────────────────────────────────────────

test('SYSTEM_PROMPT has explicit PRIVATE SEARCH hard rule with canonical sentence', () => {
  // The hard rule must be named and scoped as universal.
  expect(SYSTEM_PROMPT).toMatch(/PRIVATE SEARCH/);
  expect(SYSTEM_PROMPT).toMatch(/every report, every tier/i);

  // Backpack must be in the search-object list alongside room and phone.
  expect(SYSTEM_PROMPT).toMatch(/room, backpack, or phone/);

  // The canonical two-sentence line must appear verbatim — both sentences.
  expect(SYSTEM_PROMPT).toContain(
    "Conduct any search of your child's room, backpack, or phone privately and without your child present.",
  );
  expect(SYSTEM_PROMPT).toContain(
    'Leave the room as you found it and document anything relevant.',
  );

  // The non-negotiable words must be called out as non-negotiable.
  expect(SYSTEM_PROMPT).toMatch(/non-negotiable/i);
  expect(SYSTEM_PROMPT).toMatch(/not implied|must be written/i);
});

test('SOFT SEARCH block, WHAT TO AVOID, and DAY 2 all include backpack + canonical line', () => {
  // SOFT SEARCH block header now includes BACKPACK.
  expect(SYSTEM_PROMPT).toMatch(
    /SOFT SEARCH — HOW TO FRAME ROOM \/ BACKPACK \/ PHONE CHECKS/,
  );

  // The old "room or phone" phrasing must not survive in the relevant
  // anti-pattern sentence (WHAT TO AVOID + LANGUAGE PRECISION rule).
  expect(SYSTEM_PROMPT).not.toMatch(
    /Do not search your child's room or phone in a confrontational way/,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /Do not search your child's room, backpack, or phone in a confrontational way/,
  );

  // DAY 2 bullet must require the canonical two-sentence line in the soft-search bullet.
  const d2Start = SYSTEM_PROMPT.indexOf(
    'DAY 2 — BUILD THE SUPPORT GROUP + GATHER INFORMATION',
  );
  const d2End = SYSTEM_PROMPT.indexOf('DAY 3 — PREPARE FOR THE CONVERSATION');
  expect(d2Start).toBeGreaterThan(-1);
  expect(d2End).toBeGreaterThan(d2Start);
  const d2 = SYSTEM_PROMPT.slice(d2Start, d2End);
  expect(d2).toContain(
    "Conduct any search of your child's room, backpack, or phone privately and without your child present.",
  );
  expect(d2).toContain(
    'Leave the room as you found it and document anything relevant.',
  );

  // WHAT TO AVOID (the OUTPUT STRUCTURE section, not earlier in-prompt
  // mentions like "anywhere in the output (WHAT TO AVOID, ...)") must
  // reference backpack and the "privately and without your child present"
  // requirement. Anchor on the newline-prefixed header form so the section
  // body — not a routing-rule mention — is what we slice.
  const wtaStart = SYSTEM_PROMPT.indexOf('\nWHAT TO AVOID\n');
  const wtaEnd = SYSTEM_PROMPT.indexOf('\nFIRST 72 HOURS PLAN\n', wtaStart);
  expect(wtaStart).toBeGreaterThan(-1);
  expect(wtaEnd).toBeGreaterThan(wtaStart);
  const wta = SYSTEM_PROMPT.slice(wtaStart, wtaEnd);
  expect(wta).toMatch(/backpack/);
  expect(wta).toMatch(/privately and without your child present/);
});

test('outgoing user prompt carries the pass-#6 PRIVATE SEARCH reminder', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // PRIVATE SEARCH reminder is present.
  expect(userContent).toMatch(/PRIVATE SEARCH/);
  // The canonical two-sentence line is shipped in the reminder.
  expect(userContent).toContain(
    "Conduct any search of your child's room, backpack, or phone privately and without your child present.",
  );
  expect(userContent).toContain(
    'Leave the room as you found it and document anything relevant.',
  );

  // The LANGUAGE reminder also updated to "room, backpack, or phone".
  expect(userContent).toMatch(
    /Do not search your child's room, backpack, or phone in a confrontational way/,
  );
});

// ─── Founder review pass #7 ───────────────────────────────────────────────────

test('SYSTEM_PROMPT bans citing Articles of Action by title in the plan', () => {
  // The hard rule must be named and scoped as universal.
  expect(SYSTEM_PROMPT).toMatch(/ARTICLES OF ACTION — DO NOT CITE BY TITLE/);
  expect(SYSTEM_PROMPT).toMatch(/every report, every tier, no exceptions/i);
  expect(SYSTEM_PROMPT).toMatch(
    /never as a parent-facing reading recommendation/i,
  );
  // The banned patterns must be enumerated explicitly.
  expect(SYSTEM_PROMPT).toMatch(/'the Article of Action titled "X"'/);
  expect(SYSTEM_PROMPT).toMatch(/Article of Action: X/);

  // The Resource Ladder rewrite — Articles of Action no longer #1.
  expect(SYSTEM_PROMPT).toMatch(
    /Priority of recommendation \(parent-facing resources only — Articles of Action are NOT recommended directly/,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /1\. Essential & Auxiliary Workshops — the parent's primary learning channel/,
  );

  // The OUTPUT STRUCTURE / KEY PRIORITIES rules must NOT offer Article of
  // Action as one of the resource types the parent can be steered to.
  expect(SYSTEM_PROMPT).toMatch(
    /NEVER cite an Article of Action by title in the plan/,
  );

  // No routing-table row may still pair "AND Article of Action ...".
  expect(SYSTEM_PROMPT).not.toMatch(/AND Article of Action "/);
  expect(SYSTEM_PROMPT).not.toMatch(/OR Article of Action "/);
});

test('SYSTEM_PROMPT restricts the approved discussion-group set to M&I + SR', () => {
  // The approved list must be named explicitly.
  expect(SYSTEM_PROMPT).toMatch(/DISCUSSION GROUPS — APPROVED LIST/);
  expect(SYSTEM_PROMPT).toContain(
    '"Monitoring and Intervention discussion group"',
  );
  expect(SYSTEM_PROMPT).toContain('"Sustaining Recovery discussion group"');

  // The banned set must be enumerated.
  expect(SYSTEM_PROMPT).toMatch(/BANNED DISCUSSION GROUP NAMES/);
  expect(SYSTEM_PROMPT).toContain('"Effective Communication discussion group"');
  expect(SYSTEM_PROMPT).toContain('"Parent Support Forum discussion group"');
  expect(SYSTEM_PROMPT).toContain(
    '"Building a Support Network discussion group"',
  );
  expect(SYSTEM_PROMPT).toContain(
    '"Creating Your Personal Prevention Program discussion group"',
  );

  // No routing instruction may still recommend the banned groups as the
  // primary recommendation. Every remaining mention must sit inside a ban
  // context (BANNED, prohibited, etc.).
  const bannedGroups = [
    'Effective Communication discussion group',
    'Parent Support Forum discussion group',
    'Building a Support Network discussion group',
    'Creating Your Personal Prevention Program discussion group',
  ];
  for (const g of bannedGroups) {
    // Find each occurrence and assert it sits within a 500-char window that
    // contains a banning verb. (500 is wide enough to span the enumeration
    // of all four banned groups before the closing "is banned" clause.)
    let from = 0;
    while (from < SYSTEM_PROMPT.length) {
      const i = SYSTEM_PROMPT.indexOf(g, from);
      if (i === -1) break;
      const window = SYSTEM_PROMPT.slice(Math.max(0, i - 500), i + 500);
      expect(window).toMatch(
        /BANNED|banned|never|prohibited|wrong|labeling error/i,
      );
      from = i + 1;
    }
  }
});

test('SYSTEM_PROMPT bans indirect professional-help phrasing', () => {
  expect(SYSTEM_PROMPT).toMatch(/INDIRECT PROFESSIONAL-HELP PHRASING — BANNED/);
  expect(SYSTEM_PROMPT).toMatch(/"prepare to reach out"/);
  expect(SYSTEM_PROMPT).toMatch(/"start preparing to seek"/);
  expect(SYSTEM_PROMPT).toMatch(/banned even when the SEQUENCE follows them/i);

  // The MODERATE block's earlier wording — "still triggers the full sequence" —
  // must be replaced. The new framing says these phrasings are BANNED.
  expect(SYSTEM_PROMPT).not.toMatch(
    /"Start preparing to seek an ASAP-endorsed therapist" is not a partial substitute; the sequence still applies\./,
  );
  expect(SYSTEM_PROMPT).toMatch(
    /"Start preparing to seek an ASAP-endorsed therapist" and "prepare to reach out to an ASAP-endorsed therapist" are BANNED/,
  );
});

test('SYSTEM_PROMPT enforces directory-only workshop titles', () => {
  expect(SYSTEM_PROMPT).toMatch(/WORKSHOP TITLES — DIRECTORY-ONLY/);
  expect(SYSTEM_PROMPT).toMatch(
    /Cite a workshop ONLY if its title appears verbatim in the ASAP RESOURCE DIRECTORY/i,
  );
  expect(SYSTEM_PROMPT).toMatch(/Never invent a workshop name/i);
});

test('outgoing user prompt carries the pass-#7 reminders', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // The "do not cite Articles of Action by title" reminder is shipped.
  expect(userContent).toMatch(
    /NEVER cite an Article of Action by title in the plan/,
  );

  // The "only 2 approved discussion groups" reminder is shipped — and the
  // banned set is named.
  expect(userContent).toMatch(/ONLY two are approved for the plan/);
  expect(userContent).toMatch(
    /BANNED in any form: "Effective Communication discussion group"/,
  );

  // The indirect-phrasing ban is shipped.
  expect(userContent).toMatch(/INDIRECT PROFESSIONAL-HELP PHRASING BANNED/);
  expect(userContent).toMatch(/"prepare to reach out"/);
  expect(userContent).toMatch(/"start preparing to seek"/);

  // The workshop-titles directory-only reminder is shipped.
  expect(userContent).toMatch(/WORKSHOP TITLES are directory-only/);

  // The routing-table reminder no longer pairs AoA with the workshop.
  expect(userContent).not.toMatch(/\+ Article of Action "/);
});

// ─── Founder review pass #8 ───────────────────────────────────────────────────

test('SYSTEM_PROMPT pins "Creating a Healthy Home Environment" as AUXILIARY (not Essential)', () => {
  // The data must classify it as Auxiliary.
  const essentialTitles = ESSENTIAL_WORKSHOPS.map((w) => w.title);
  const auxiliaryTitles = AUXILIARY_WORKSHOPS.map((w) => w.title);
  expect(essentialTitles).not.toContain(
    'Creating a Healthy Home Environment – The Power of Structure and Routine',
  );
  expect(auxiliaryTitles).toContain(
    'Creating a Healthy Home Environment – The Power of Structure and Routine',
  );

  // The system prompt must call this out explicitly — parallel to the
  // existing "Building a Support Network is Essential, not Auxiliary"
  // call-out — so the model stops mislabeling it. The call-out names the
  // common confusion with the Essential Workshop "Creating Your
  // Personalized Prevention Plan".
  expect(SYSTEM_PROMPT).toMatch(
    /"Creating a Healthy Home Environment – The Power of Structure and Routine" is an AUXILIARY Workshop, not Essential/,
  );
  expect(SYSTEM_PROMPT).toMatch(/Creating Your Personalized Prevention Plan/);
});

test('outgoing user prompt carries the pass-#8 CHHE-is-Auxiliary reminder', async ({
  request,
}) => {
  const res = await post(request, { responses: SAMPLE });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  expect(userContent).toMatch(
    /"Creating a Healthy Home Environment – The Power of Structure and Routine" is AUXILIARY, never Essential/,
  );
});

// ─── Claude Failure ───────────────────────────────────────────────────────────

test('returns 500 when OpenAI API fails', async () => {
  const errorServer = http.createServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'upstream error' } }));
  });

  await new Promise<void>((r) => errorServer.listen(4002, r));

  const failApp = spawn(
    'npx',
    ['ts-node', '-r', 'tsconfig-paths/register', 'src/main.ts'],
    {
      env: {
        ...process.env,
        PORT: '3002',
        API_SECRET_KEY: 'test-secret',
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: 'http://localhost:4002',
      },
      stdio: 'pipe',
    },
  );

  try {
    await new Promise<void>((resolve, reject) => {
      failApp.stdout?.on('data', (chunk: Buffer) => {
        if (
          chunk.toString().includes('Nest application successfully started')
        ) {
          resolve();
        }
      });
      failApp.on('error', reject);
      setTimeout(() => reject(new Error('Fail app did not start')), 20000);
    });

    const res = await fetch('http://localhost:3002/api/report/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-secret',
      },
      body: JSON.stringify({ responses: VALID }),
    });

    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: 'Report generation failed. Please try again.',
    });
  } finally {
    failApp.kill();
    await new Promise<void>((r) => errorServer.close(() => r()));
  }
});

// ─── Milestone 6 — Crisis field + severity recalibration + answer labels ────

test('Milestone 6: DTO accepts an optional crisis string', async ({
  request,
}) => {
  const res = await post(request, {
    responses: VALID,
    crisis: 'Found pills in the bedroom. Worried about fentanyl.',
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
});

test('Milestone 6: DTO accepts a missing crisis field (treated as no crisis)', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);
});

test('Milestone 6: DTO rejects a non-string crisis field with 400', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID, crisis: 12345 });
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(typeof json.error).toBe('string');
});

test('Milestone 6: DTO rejects an oversized crisis field with 400', async ({
  request,
}) => {
  const res = await post(request, {
    responses: VALID,
    crisis: 'x'.repeat(501),
  });
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.success).toBe(false);
});

test('Milestone 6: non-empty crisis auto-promotes severity to SERIOUS in user prompt', async ({
  request,
}) => {
  // VALID is all 2s — without crisis this would be MODERATE/MILD. With the
  // crisis field non-empty, the hard escalator forces SERIOUS regardless.
  const res = await post(request, {
    responses: VALID,
    crisis: 'Suspected fentanyl exposure.',
  });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('SEVERITY LEVEL: SERIOUS');
  expect(userContent).toContain('URGENT CONCERN');
  expect(userContent).toContain('Suspected fentanyl exposure.');
});

test('Milestone 6: whitespace-only crisis does NOT auto-promote', async ({
  request,
}) => {
  // The hard escalator only fires for non-empty trimmed input. A whitespace
  // string is treated as no crisis.
  const res = await post(request, {
    responses: VALID,
    crisis: '   \n\t  ',
  });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  // All 2s + no crisis → MODERATE per the current bands.
  expect(userContent).toContain('SEVERITY LEVEL: MODERATE');
  // The context-block header (which only fires when crisis is non-empty)
  // must NOT appear. The literal phrase "URGENT CONCERN ACKNOWLEDGED"
  // appears in the closing instruction in both branches, so we anchor on
  // the parent-flagged context-block header specifically.
  expect(userContent).not.toContain('URGENT CONCERN — parent flagged this');
});

test('Milestone 6: Q23=4 + Q24=4 alone do NOT trigger SERIOUS (parent internal-state demotion)', async ({
  request,
}) => {
  // Child-safety subset (Q1, Q2, Q10) all = 2; only the two parent-internal
  // questions are 4. Per the Milestone 6 demotion, SERIOUS no longer fires
  // from parent worry/readiness alone — this should land in MODERATE.
  const responses = Array(24).fill(2);
  responses[22] = 4; // Q23
  responses[23] = 4; // Q24

  const res = await post(request, { responses });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).not.toContain('SEVERITY LEVEL: SERIOUS');
  expect(userContent).toContain('SEVERITY LEVEL: MODERATE');
});

test('Milestone 6: 3+ fours on conflict/household with child-safety low does NOT trigger SERIOUS', async ({
  request,
}) => {
  // Three fours spread across conflict / household / co-parent — none in
  // child-safety. Old gate would fire SERIOUS via fours>=3 && safetyFour>=1
  // because Q23/Q24 used to count; new gate requires a child-safety four.
  const responses = Array(24).fill(2);
  responses[4] = 4; // Q5 — conflict intensity
  responses[10] = 4; // Q11 — co-parent alignment
  responses[22] = 4; // Q23 — parent worry (no longer counts toward safetyFours)

  const res = await post(request, { responses });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).not.toContain('SEVERITY LEVEL: SERIOUS');
});

test('Milestone 6: child-safety four (Q1=4) keeps SERIOUS path open when fours>=3', async ({
  request,
}) => {
  // Mirror of the previous test but with Q1=4 instead of Q23=4 — at least
  // one of the three fours is now in the child-safety subset, so SERIOUS
  // fires via the fours-count pathway.
  const responses = Array(24).fill(2);
  responses[0] = 4; // Q1 — confirmed/strongly-suspected use (child-safety)
  responses[4] = 4; // Q5 — conflict intensity
  responses[10] = 4; // Q11 — co-parent alignment

  const res = await post(request, { responses });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;
  expect(userContent).toContain('SEVERITY LEVEL: SERIOUS');
});

test('Milestone 6: user prompt carries per-question answer labels for scored 4s and 1s', async ({
  request,
}) => {
  // SAMPLE has Q1=4 (concern) and Q4=2 — no strengths, plenty of concerns.
  // Use a mix of 1s and 4s to verify both blocks render labels.
  const responses = [...SAMPLE];
  responses[3] = 1; // Q4 — strength
  responses[19] = 1; // Q20 — strength

  const res = await post(request, { responses });
  expect(res.status()).toBe(200);

  const captured = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent: string = captured.body.messages[1].content;

  // Concerns block: each scored 4 is followed by the parent's chosen label.
  // Q1=4 → "Confirmed or seen direct evidence"
  expect(userContent).toContain(
    "Parent's answer: Confirmed or seen direct evidence",
  );
  // Q3=4 → "Constantly — will not engage at all"
  expect(userContent).toContain(
    "Parent's answer: Constantly — will not engage at all",
  );

  // Strengths block: each scored 1 is followed by the parent's chosen label.
  // Q4=1 → "Rarely or never" (the Q4 label index 0)
  expect(userContent).toContain('Strengths (scored 1');
  expect(userContent).toContain("Parent's answer: Rarely or never");
  // Q20=1 → "Strong routine — sleep, school, meals, activities"
  expect(userContent).toContain(
    "Parent's answer: Strong routine — sleep, school, meals, activities",
  );
});

test('Milestone 6: user prompt template lists URGENT header when crisis fires, omits it otherwise', async ({
  request,
}) => {
  // No crisis — header list must NOT include URGENT CONCERN ACKNOWLEDGED.
  await post(request, { responses: VALID });
  const captured1 = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent1: string = captured1.body.messages[1].content;
  // Look at the tail of the user prompt (the explicit "Use EXACTLY these…" list).
  expect(userContent1).toContain('seven section headers');
  expect(userContent1).not.toMatch(
    /URGENT CONCERN ACKNOWLEDGED\nHEADLINE SUMMARY/,
  );

  // With crisis — header list MUST include URGENT CONCERN ACKNOWLEDGED.
  await post(request, { responses: VALID, crisis: 'suspected overdose' });
  const captured2 = await (await fetch(`${MOCK_BASE}/_last`)).json();
  const userContent2: string = captured2.body.messages[1].content;
  expect(userContent2).toContain('eight section headers');
  expect(userContent2).toMatch(/URGENT CONCERN ACKNOWLEDGED\nHEADLINE SUMMARY/);
});

test('Milestone 6: URGENT CONCERN ACKNOWLEDGED section parses into report.urgentConcern when crisis fires', async ({
  request,
}) => {
  // The mock server's smart-response branches on the URGENT CONCERN block and
  // emits a real URGENT CONCERN ACKNOWLEDGED section ahead of HEADLINE SUMMARY.
  const res = await post(request, {
    responses: VALID,
    crisis: 'Threats of self-harm last night.',
  });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.success).toBe(true);
  expect(typeof body.report.urgentConcern).toBe('string');
  expect(body.report.urgentConcern.length).toBeGreaterThan(0);
  expect(body.report.urgentConcern).toMatch(/flagged something acute/);
  // The other 7 sections still populate.
  expect(body.report.headlineSummary.length).toBeGreaterThan(0);
  expect(body.report.encouragement.length).toBeGreaterThan(0);
});

test('Milestone 6: URGENT CONCERN section is empty in report when no crisis was supplied', async ({
  request,
}) => {
  const res = await post(request, { responses: VALID });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.report.urgentConcern).toBe('');
});

test('Milestone 6: SYSTEM_PROMPT has the URGENT CONCERN hard rule with trigger-keyword resource map', () => {
  expect(SYSTEM_PROMPT).toMatch(
    /URGENT CONCERN — OPTIONAL CRISIS FIELD \(HARD RULE/,
  );
  // Trigger-keyword anchors.
  expect(SYSTEM_PROMPT).toMatch(/988 Suicide & Crisis Lifeline/);
  expect(SYSTEM_PROMPT).toMatch(/Poison Control at 1-800-222-1222/);
  expect(SYSTEM_PROMPT).toMatch(/Narcan/);
  expect(SYSTEM_PROMPT).toMatch(/1-800-799-7233/); // National DV Hotline
  expect(SYSTEM_PROMPT).toMatch(/1-800-786-2929/); // Runaway Safeline
  expect(SYSTEM_PROMPT).toMatch(/2–3 short, calm, direction-giving sentences/);
  expect(SYSTEM_PROMPT).toMatch(/NEVER alarmist/);
  // Conditional emission: only when the URGENT CONCERN block is present.
  expect(SYSTEM_PROMPT).toMatch(
    /ONLY when the user message included an URGENT CONCERN block/,
  );
});

test('Milestone 6: ANSWER_LABELS arrays are 24 × 4 in both languages and monotonically 1=strength → 4=concern by stem', async () => {
  const { ANSWER_LABELS } = await import('../src/report/prompts/questions');
  const { ANSWER_LABELS_ES } =
    await import('../src/report/prompts/questions.es');
  expect(ANSWER_LABELS).toHaveLength(24);
  expect(ANSWER_LABELS_ES).toHaveLength(24);
  for (const labels of ANSWER_LABELS) expect(labels).toHaveLength(4);
  for (const labels of ANSWER_LABELS_ES) expect(labels).toHaveLength(4);
  // Spot-check: Q1 score=4 label is the strongest concern, score=1 is the
  // strongest strength.
  expect(ANSWER_LABELS[0][0]).toMatch(/have not/i);
  expect(ANSWER_LABELS[0][3]).toMatch(/Confirmed/);
  expect(ANSWER_LABELS_ES[0][3]).toMatch(/Confirmado/);
});
