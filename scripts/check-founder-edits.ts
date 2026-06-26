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
check('PARENT EMOTIONAL REGULATION label pinned', SYSTEM_PROMPT, 'The label for this priority is exactly "PARENT EMOTIONAL REGULATION"');
check('gendered "FOR THE FATHER" label banned', SYSTEM_PROMPT, 'Never label it "EMOTIONAL REGULATION FOR THE FATHER,"');
check('ambiguous-pronoun "He arrives clear" banned', SYSTEM_PROMPT, 'A sentence like "He arrives clear and calm"');
check('"Name this straight" / disadvantage banned', SYSTEM_PROMPT, 'do not open a sentence with "Name this straight"');

console.log('\n## ENGLISH CRITICAL (crisis path)');
check('URGENT opening drops vape', SYSTEM_PROMPT, 'do NOT list "vape," "vaping," or "vape cartridge"');
check('URGENT opening heroin/fentanyl framing', SYSTEM_PROMPT, 'admitted to using heroin, fentanyl, or another drug that can cause serious harm');
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
check('ES URGENT heroin/fentanyl framing', SYSTEM_PROMPT_ES, 'admitió haber usado heroína, fentanilo u otra droga que puede causar daño grave');
check('ES naloxone home/vehicle/caregivers', SYSTEM_PROMPT_ES, 'mantener naloxona (Narcan) accesible en la casa, en el vehículo y con los cuidadores');
check('ES closing residential + IOP', SYSTEM_PROMPT_ES, 'centros de tratamiento residencial y los programas IOP');
check('ES crisis build carries GRAVE drug-testing rule', esCrit, 'REGLA DURA 8 (PRUEBAS DE DROGAS');

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
