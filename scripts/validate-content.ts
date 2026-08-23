/**
 * Loads and cross-validates `content/`, then prints what it found.
 *
 * Exits non-zero on a fatal problem, so it can gate CI. Warnings are printed and
 * do not fail — a workshop with no URL yet is a known outstanding item, not a
 * broken build.
 *
 *   npm run content:validate
 */
import { loadContent, resolveContentDir } from '../src/content/content.loader';
import { ContentValidationError } from '../src/content/content.types';

try {
  const dir = resolveContentDir();
  const bundle = loadContent(dir);
  const { assessment, matrix, workshops, sections } = bundle;

  console.log(`content/ at ${dir}\n`);
  console.log(`  assessment  ${assessment.version} (${assessment.status})`);
  console.log(
    `              ${assessment.questions.length} scored questions, ${assessment.domains.length} domains, ${assessment.gates.length} gate(s)`,
  );
  console.log(`  matrix      ${matrix.version} (${matrix.status})`);
  console.log(
    `              ${matrix.tiers.length} tiers, ${matrix.recommendations.length} recommendations, ${matrix.tierGates.length} tier gates`,
  );
  console.log(
    `  workshops   ${workshops.workshops.length} workshops, ${workshops.discussionGroups.length} discussion groups, ${workshops.requiredWording.length} wording rules`,
  );
  console.log(
    `  sections    ${sections.sections.length} (${sections.sections.filter((s) => s.type === 'static').length} static, ${sections.sections.filter((s) => s.when).length} conditional)`,
  );
  console.log(`  methodology ${matrix.methodologyVersion}`);

  const disabled = matrix.recommendations.filter(
    (r) => 'always' in r.when && r.when.always === false,
  );
  if (disabled.length > 0) {
    console.log(
      `\n  ${disabled.length} recommendation(s) deliberately disabled: ${disabled.map((r) => r.id).join(', ')}`,
    );
  }

  if (bundle.warnings.length > 0) {
    console.log(`\n${bundle.warnings.length} warning(s):`);
    for (const warning of bundle.warnings) console.log(`  · ${warning}`);
  }

  console.log('\ncontent/ is valid.');
} catch (err) {
  if (err instanceof ContentValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
