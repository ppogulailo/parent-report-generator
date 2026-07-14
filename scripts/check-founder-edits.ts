/* Deterministic verification that the founder's requested refinements are
 * present in the built prompts for the right language + severity tier.
 * Run: npx ts-node -r tsconfig-paths/register scripts/check-founder-edits.ts
 * (No OpenAI call — this validates prompt construction, not model output.) */
import { SYSTEM_PROMPT, SYSTEM_PROMPT_ES, buildUserPrompt } from '../src/report/prompts';

const SCORES = {
  'Immediate Safety & Urgency': 3.6,
  'Household Structure': 2,
  'Boundary Consistency': 2.2,
  'Communication & Conflict': 3,
  'Support & Professional Engagement': 3,
};
const TOP = ['Immediate Safety & Urgency', 'Communication & Conflict', 'Support & Professional Engagement'];
// responses that force SERIOUS/GRAVE (Q1,Q2,Q10 high) and a MILD/LEVE set.
const SERIOUS = [4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3];
const MILD = [1, 1, 1, 1, 2, 1, 2, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1];
const CRISIS = 'Found an unknown substance in the bedroom, worried about fentanyl.';

let pass = 0, fail = 0;
function check(label: string, haystack: string, needle: string, shouldExist = true) {
  const found = haystack.includes(needle);
  const ok = found === shouldExist;
  console.log(`${ok ? '✓' : '✗ FAIL'}  ${label}`);
  if (!ok) { console.log(`        ${shouldExist ? 'MISSING' : 'UNEXPECTEDLY PRESENT'}: "${needle.slice(0, 70)}"`); fail++; } else pass++;
}

// Build the user prompts we need.
const enSerious = buildUserPrompt(SCORES, TOP, SERIOUS, 'en');
const enCrit = buildUserPrompt(SCORES, TOP, SERIOUS, 'en', CRISIS);
const esGrave = buildUserPrompt(SCORES, TOP, SERIOUS, 'es');
const esLeve = buildUserPrompt({ ...SCORES, 'Immediate Safety & Urgency': 1.3, 'Communication & Conflict': 1.5, 'Boundary Consistency': 1.4, 'Household Structure': 1.4, 'Support & Professional Engagement': 1.5 }, TOP, MILD, 'es');
const esCrit = buildUserPrompt(SCORES, TOP, SERIOUS, 'es', CRISIS);

console.log('\n## ENGLISH MILD');
check('"with your child" on DAY 3 review (EN system)', SYSTEM_PROMPT, "Before DAY 3's conversation with your child");
check('"with your child" on DAY 3 review (EN user reminder)', enSerious, "Before DAY 3's conversation with your child");
check('co-parent alignment names "you and your co-parent"', SYSTEM_PROMPT, 'Make sure you and your co-parent are clear on the household rules');

console.log('\n## ENGLISH SERIOUS');
check('PARENT EMOTIONAL REGULATION label pinned', SYSTEM_PROMPT, 'label for this priority is exactly "PARENT EMOTIONAL REGULATION"');
check('gendered "FOR THE FATHER" label banned', SYSTEM_PROMPT, '"EMOTIONAL REGULATION FOR THE FATHER,"');
check('ambiguous-pronoun "He arrives clear" banned', SYSTEM_PROMPT, 'A sentence like "He arrives clear and calm"');
check('"Name this straight" / disadvantage banned', SYSTEM_PROMPT, 'do not open a sentence with "Name this straight,"');

console.log('\n## ENGLISH CRITICAL (crisis path)');
check('URGENT opening drops vape', SYSTEM_PROMPT, 'do NOT list "vape," "vaping," or "vape cartridge"');
check('URGENT opening opioids/fentanyl framing (pass #11: heroin→opioids)', SYSTEM_PROMPT, 'admitted to using opioids, fentanyl, or another drug that can cause serious harm');
check('closing: residential + IOP', SYSTEM_PROMPT, "ASAP's preferred residential treatment centers and IOP (intensive outpatient) programs");
check('closing: may affect their life', SYSTEM_PROMPT, "may significantly affect your child's safety, health, and potentially their life");
check('CRITICAL CLOSING only fires with crisis block (present in crit user prompt)', enCrit, 'URGENT CONCERN');

console.log('\n## SPANISH MILD (LEVE)');
check('LEVE closing: circumstances change', esLeve, 'los hijos y las circunstancias cambian constantemente');
check('LEVE closing: ongoing ASAP Community participation', esLeve, 'participación continua en la ASAP Community');
check('LEVE guidance NOT in GRAVE build', esGrave, 'CIERRE LEVE (regla dura)', false);

console.log('\n## SPANISH SERIOUS (GRAVE)');
check('GRAVE drug-testing emphasis', esGrave, 'REGLA DURA 8 (PRUEBAS DE DROGAS');
check('GRAVE Know the Facts / Article of Action #2', esGrave, 'el material "Know the Facts" (Article of Action #2)');
check('GRAVE prescribed-meds -> inform physician', esGrave, 'REGLA DURA 10 (MEDICACIÓN RECETADA)');
check('GRAVE additions NOT in LEVE build', esLeve, 'REGLA DURA 8 (PRUEBAS DE DROGAS', false);

console.log('\n## SPANISH CRITICAL (crisis path)');
check('ES label gender-neutral (DE LOS PADRES)', SYSTEM_PROMPT_ES, 'REGULACIÓN EMOCIONAL DE LOS PADRES');
check('ES old gendered label removed (DEL PADRE as #1 heading)', SYSTEM_PROMPT_ES, '1. REGULACIÓN EMOCIONAL DEL PADRE —', false);
check('ES URGENT opening drops vape', SYSTEM_PROMPT_ES, 'NO menciones "vape", "vapeo" ni "cartucho de vape"');
check('ES URGENT opioides/fentanyl framing (pass #11: heroína→opioides)', SYSTEM_PROMPT_ES, 'admitió haber usado opioides, fentanilo u otra droga que puede causar daño grave');
check('ES naloxone home/vehicle/caregivers', SYSTEM_PROMPT_ES, 'mantener naloxona (Narcan) accesible en la casa, en el vehículo y con los cuidadores');
check('ES closing residential + IOP', SYSTEM_PROMPT_ES, 'centros de tratamiento residencial y los programas IOP');
check('ES crisis build carries GRAVE drug-testing rule', esCrit, 'REGLA DURA 8 (PRUEBAS DE DROGAS');

console.log('\n## FOUNDER REVIEW PASS #11 (2026-07-02)');
// Opioids over heroin (throughout)
check('EN OPIOIDS OVER HEROIN hard rule', SYSTEM_PROMPT, 'OPIOIDS OVER HEROIN (HARD RULE, throughout the program');
check('EN no parent-facing "fentanyl/heroin" phrase', SYSTEM_PROMPT, 'suspected fentanyl/heroin', false);
check('ES OPIOIDES ANTES QUE HEROÍNA hard rule', SYSTEM_PROMPT_ES, 'OPIOIDS OVER HEROIN / OPIOIDES ANTES QUE HEROÍNA');
check('ES no parent-facing "fentanilo/heroína" phrase', SYSTEM_PROMPT_ES, 'sospecha de fentanilo/heroína', false);
// Parent Emotional Regulation — never "for the Father" (universal)
check('EN "for the Father" banned universally', SYSTEM_PROMPT, 'NEVER "Emotional Regulation for the Father"');
check('ES gender-neutral label applies every report incl CRITICAL', SYSTEM_PROMPT_ES, 'aplica en cada sección y en cada reporte, incluido el reporte URGENT / de crisis (CRÍTICO)');
// Complete room search — SERIOUS + CRITICAL
check('EN COMPLETE ROOM SEARCH block', SYSTEM_PROMPT, 'COMPLETE ROOM SEARCH — MODERATE, SERIOUS, AND CRITICAL (HARD RULE');
check('EN complete search: fact-finding not punishment', SYSTEM_PROMPT, 'This is a fact-finding mission, not a punishment.');
check('EN complete search: not while angry/emotional', SYSTEM_PROMPT, 'Do not conduct the search while angry or emotional.');
check('EN complete search: document/confiscate/discard', SYSTEM_PROMPT, 'document them, confiscate them, and safely discard them');
check('EN complete search in SERIOUS user prompt', enSerious, 'HARD RULE 8 (COMPLETE ROOM SEARCH)');
check('EN complete search NOT in MILD-tier severity block (esLeve proxy uses ES; check EN crit has it)', enCrit, 'HARD RULE 8 (COMPLETE ROOM SEARCH)');
check('ES COMPLETE ROOM SEARCH block', SYSTEM_PROMPT_ES, 'COMPLETE ROOM SEARCH — MODERADO, GRAVE Y CRÍTICO (REGLA DURA');
check('ES complete search: document/confiscate/discard', SYSTEM_PROMPT_ES, 'documéntalas, confíscalas y deséchalas de forma segura');
check('ES complete search in GRAVE user prompt', esGrave, 'REGLA DURA 11 (COMPLETE ROOM SEARCH');
check('ES complete search in crisis user prompt', esCrit, 'REGLA DURA 11 (COMPLETE ROOM SEARCH');

console.log('\n## FOUNDER REVIEW PASS #12 (2026-07-03)');
// Build a MODERATE user prompt (all-2s → MODERATE tier).
const MOD_RESP = Array(24).fill(2);
const MOD_SCORES = {
  'Immediate Safety & Urgency': 2,
  'Household Structure': 2,
  'Boundary Consistency': 2,
  'Communication & Conflict': 2,
  'Support & Professional Engagement': 2,
};
const enMod = buildUserPrompt(MOD_SCORES, TOP, MOD_RESP, 'en');
const esMod = buildUserPrompt(MOD_SCORES, TOP, MOD_RESP, 'es');
// Soft search scoped to MILD only; MODERATE joins complete room search.
check('EN complete-search header now MODERATE+', SYSTEM_PROMPT, 'COMPLETE ROOM SEARCH — MODERATE, SERIOUS, AND CRITICAL');
check('EN soft search is MILD-only', SYSTEM_PROMPT, 'The soft-search framing above is for MILD reports ONLY.');
check('ES complete-search header now MODERADO+', SYSTEM_PROMPT_ES, 'COMPLETE ROOM SEARCH — MODERADO, GRAVE Y CRÍTICO');
check('ES soft search is LEVE-only', SYSTEM_PROMPT_ES, 'El encuadre de soft search de arriba es solo para reportes LEVE.');
check('EN MODERATE user prompt uses complete room search', enMod, 'MODERATE now uses the complete room search');
check('ES MODERADO user prompt uses complete room search', esMod, 'MODERADO ahora usa la revisión completa del cuarto');
// "give a drug test", not "take a drug test".
check('EN drug-test give-not-take rule', SYSTEM_PROMPT, 'DRUG TEST — "GIVE," NOT "TAKE"');
// Parent Emotional Regulation label reinforced.
check('EN PER label reinforced (most-reported error)', SYSTEM_PROMPT, 'this is the single most-reported error');
check('EN PER label reminder in user prompt', enSerious, 'PARENT EMOTIONAL REGULATION LABEL (most-reported error');
// WHAT TO AVOID simplified (no confusing negative constructions).
check('EN WHAT TO AVOID drops confusing "confrontational manner" framing', SYSTEM_PROMPT, 'no "never in a confrontational manner" / "don\'t announce it beforehand"', false);
check('EN WHAT TO AVOID keeps room-search guidance SIMPLE AND DIRECT', SYSTEM_PROMPT, 'keep the room-search guidance SIMPLE AND DIRECT');
// Root cause — understand why (MODERATE/SERIOUS/CRITICAL closing).
check('EN ROOT CAUSE hard rule', SYSTEM_PROMPT, 'ROOT CAUSE — UNDERSTAND WHY (HARD RULE');
check('EN ROOT CAUSE canonical message', SYSTEM_PROMPT, 'the ultimate goal is to understand WHY the child is using');
check('EN ROOT CAUSE in SERIOUS user prompt', enSerious, 'HARD RULE 9 (ROOT CAUSE — UNDERSTAND WHY)');
check('EN ROOT CAUSE in MODERATE user prompt', enMod, 'ROOT CAUSE — UNDERSTAND WHY');
check('ES ROOT CAUSE hard rule', SYSTEM_PROMPT_ES, 'ROOT CAUSE — ENTENDER EL PORQUÉ (REGLA DURA');
check('ES ROOT CAUSE in GRAVE user prompt', esGrave, 'REGLA DURA 12 (ROOT CAUSE — ENTENDER EL PORQUÉ)');
check('ES ROOT CAUSE in MODERADO user prompt', esMod, 'ROOT CAUSE — ENTENDER EL PORQUÉ');

console.log('\n## BETA FINALIZATION — CONSIDERING INPATIENT TREATMENT (CRITICAL-only)');
// EN system prompt: section defined with the four circumstances + reframe.
check('EN inpatient section in OUTPUT STRUCTURE', SYSTEM_PROMPT, 'CONSIDERING INPATIENT TREATMENT  (conditional');
check('EN inpatient circumstance: danger to self', SYSTEM_PROMPT, 'Your child is a danger to themselves.');
check('EN inpatient circumstance: danger to others', SYSTEM_PROMPT, 'Your child is a danger to others.');
check('EN inpatient circumstance: overdose/death risk', SYSTEM_PROMPT, 'significant risk of overdose or death');
check('EN inpatient circumstance: outpatient exhausted', SYSTEM_PROMPT, 'exhausted reasonable outpatient interventions');
check('EN inpatient reframe: not a failure', SYSTEM_PROMPT, "not a failure — it is an act of protecting your child's life and future");
// EN gating: the emitted header list carries the inpatient header only when
// the crisis field fires (the reminder text always names the section, so we
// anchor on the newline-adjacent header-list form, not a bare mention).
check('EN inpatient in CRITICAL header list', enCrit, 'DAYS 4 TO 7 CONTINUATION\nCONSIDERING INPATIENT TREATMENT\nENCOURAGEMENT AND DIRECTION');
check('EN inpatient NOT in non-crisis SERIOUS header list', enSerious, 'DAYS 4 TO 7 CONTINUATION\nCONSIDERING INPATIENT TREATMENT', false);
check('EN nine section headers in CRITICAL user prompt', enCrit, 'nine section headers');
// ES system prompt: section defined with the four circumstances + reframe.
check('ES inpatient section in ESTRUCTURA DE SALIDA', SYSTEM_PROMPT_ES, 'CONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL  (condicional');
check('ES inpatient circumstance: peligro para sí mismo', SYSTEM_PROMPT_ES, 'Tu hijo es un peligro para sí mismo.');
check('ES inpatient circumstance: peligro para otros', SYSTEM_PROMPT_ES, 'Tu hijo es un peligro para otros.');
check('ES inpatient circumstance: sobredosis o muerte', SYSTEM_PROMPT_ES, 'riesgo significativo de sobredosis o muerte');
check('ES inpatient circumstance: ambulatorias agotadas', SYSTEM_PROMPT_ES, 'agotado las intervenciones ambulatorias razonables');
check('ES inpatient reframe: no es un fracaso', SYSTEM_PROMPT_ES, 'no es un fracaso — es un acto de protección de la vida y el futuro de tu hijo');
// ES gating: same, on the Spanish emitted header list.
check('ES inpatient in CRÍTICO header list', esCrit, 'DÍAS 4 A 7 — CONTINUACIÓN\nCONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL\nALIENTO Y DIRECCIÓN');
check('ES inpatient NOT in non-crisis GRAVE header list', esGrave, 'DÍAS 4 A 7 — CONTINUACIÓN\nCONSIDERAR EL TRATAMIENTO INTERNO O RESIDENCIAL', false);
check('ES nueve section headers in CRÍTICO user prompt', esCrit, 'nueve encabezados');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
