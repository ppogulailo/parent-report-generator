import type { Condition } from './schemas/rule.schema';
import type { Assessment } from './schemas/assessment.schema';
import type { RecommendationMatrix } from './schemas/matrix.schema';
import type { ReportSectionsConfig } from './schemas/sections.schema';
import type { VoiceConfig } from './schemas/voice.schema';
import type { Workshops } from './schemas/workshops.schema';
import {
  LANGUAGES,
  PROMPT_PLACEHOLDERS,
  REQUIRED_USER_PLACEHOLDERS,
  type PromptTemplates,
} from './content.types';

/**
 * Cross-file validation — the checks no single Zod schema can make, because they
 * span files: does a routing rule name a workshop that exists, does every
 * condition reference a real question, is the last tier actually a catch-all.
 *
 * Everything returned in `problems` is fatal and stops the app booting.
 * Everything in `warnings` is logged and does not.
 *
 * The division is deliberate. A rule pointing at a workshop that does not exist
 * is a family silently not receiving a recommendation, so it must not ship. A
 * workshop with no URL yet is a report that names a resource without linking it
 * — worse than linking it, better than no report at all.
 */
export function validateContent(bundle: {
  assessment: Assessment;
  workshops: Workshops;
  matrix: RecommendationMatrix;
  sections: ReportSectionsConfig;
  voice: VoiceConfig;
}): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];

  const { assessment, workshops, matrix, sections, voice } = bundle;

  const questionIds = new Set(assessment.questions.map((q) => q.id));
  const domainIds = new Set(assessment.domains.map((d) => d.id));
  const gateIds = new Map(assessment.gates.map((g) => [g.id, g]));
  const workshopIds = new Set(workshops.workshops.map((w) => w.id));
  const groupIds = new Set(workshops.discussionGroups.map((g) => g.id));
  const tierIds = new Set(matrix.tiers.map((t) => t.id));
  const recommendationIds = new Set(matrix.recommendations.map((r) => r.id));

  // ---------------------------------------------------------------- assessment

  for (const domain of assessment.domains) {
    for (const id of domain.questionIds) {
      if (!questionIds.has(id)) {
        problems.push(
          `assessment: domain "${domain.id}" lists question "${id}", which does not exist`,
        );
      }
    }
  }

  for (const id of assessment.tieBreakOrder) {
    if (!domainIds.has(id)) {
      problems.push(
        `assessment: tieBreakOrder names domain "${id}", which does not exist`,
      );
    }
  }
  // Ranking a domain absent from the tie-break order is unpredictable, so the
  // order must be total rather than partial.
  for (const domain of assessment.domains) {
    if (!assessment.tieBreakOrder.includes(domain.id)) {
      problems.push(
        `assessment: domain "${domain.id}" is missing from tieBreakOrder — ties involving it would rank unpredictably`,
      );
    }
  }

  const scoredQuestions = new Set(
    assessment.domains.flatMap((d) => d.questionIds),
  );
  const orphans = assessment.questions
    .map((q) => q.id)
    .filter((id) => !scoredQuestions.has(id));
  if (orphans.length > 0) {
    // A warning, not an error: a domainless question contributes to no domain
    // average, which can be a decision rather than a mistake — q04 was exactly
    // that until the founder assigned it on 2026-08-25. Surfaced every boot so
    // any future orphan stays a known decision rather than becoming folklore.
    warnings.push(
      `assessment: ${orphans.join(', ')} belong${orphans.length === 1 ? 's' : ''} to no domain, so ${orphans.length === 1 ? 'it contributes' : 'they contribute'} to no domain average. Confirm this is a founder decision, not a dropped mapping.`,
    );
  }

  // ----------------------------------------------------------------- workshops

  for (const workshop of workshops.workshops) {
    for (const domainId of workshop.applicableDomains) {
      if (!domainIds.has(domainId)) {
        problems.push(
          `workshops: "${workshop.id}" lists applicableDomain "${domainId}", which does not exist`,
        );
      }
    }
  }

  const missingUrls = [
    ...workshops.workshops.filter((w) => w.url === null).map((w) => w.id),
    ...workshops.discussionGroups
      .filter((g) => g.url === null)
      .map((g) => g.id),
  ];
  if (missingUrls.length > 0) {
    warnings.push(
      `workshops: ${missingUrls.length} of ${workshops.workshops.length + workshops.discussionGroups.length} resources have no URL yet — reports will name them without linking them. Blocked on the client's Circle URL list.`,
    );
  }

  const inferred = workshops.workshops.filter((w) => w.domainsInferred);
  if (inferred.length > 0) {
    warnings.push(
      `workshops: ${inferred.length} workshops have inferred domain mappings rather than mappings the routing table states outright (${inferred.map((w) => w.id).join(', ')}). Listed for confirmation in RECOMMENDATION-MATRIX.md §5.`,
    );
  }

  for (const rule of workshops.requiredWording) {
    for (const tierId of rule.appliesAtTiers ?? []) {
      if (!tierIds.has(tierId)) {
        problems.push(
          `workshops: requiredWording "${rule.id}" applies at tier "${tierId}", which does not exist`,
        );
      }
    }
  }

  // A banned title that is also a live resource would be simultaneously required
  // and forbidden — and the ban would win, silently removing a workshop the
  // matrix routes to.
  const liveTitles = new Set([
    ...workshops.workshops.map((w) => w.title),
    ...workshops.discussionGroups.map((g) => g.name),
  ]);
  for (const title of workshops.bannedTitles.workshops) {
    if (liveTitles.has(title)) {
      problems.push(
        `workshops: "${title}" is in bannedTitles and is also a live resource — it cannot be both`,
      );
    }
  }

  // -------------------------------------------------------------------- matrix

  if (matrix.assessmentVersion !== assessment.version) {
    problems.push(
      `matrix: written against assessment ${matrix.assessmentVersion} but content/assessment.json is ${assessment.version} — question ids may have moved under it`,
    );
  }

  if (matrix.methodologyVersion !== assessment.methodologyVersion) {
    problems.push(
      `matrix: methodologyVersion ${matrix.methodologyVersion} does not match the assessment's ${assessment.methodologyVersion}`,
    );
  }

  for (const id of matrix.primaryTieBreak) {
    if (!domainIds.has(id)) {
      problems.push(
        `matrix: primaryTieBreak names domain "${id}", which does not exist`,
      );
    }
  }

  // The last tier must match everything, or a submission could match no tier at
  // all and the selection service would have nothing to fall back on.
  const lastTier = matrix.tiers[matrix.tiers.length - 1];
  if (!isCatchAll(lastTier.when)) {
    problems.push(
      `matrix: the last tier "${lastTier.id}" is not a catch-all ({ "always": true }) — a submission matching no tier would fail at generation time`,
    );
  }

  for (const tier of matrix.tiers) {
    problems.push(
      ...conditionProblems(
        tier.when,
        `matrix: tier "${tier.id}"`,
        questionIds,
        domainIds,
        gateIds,
      ),
    );
    // A tier cannot be defined in terms of the tier. The evaluator would return
    // false for it, so the rule would never fire and the tier would be dead.
    if (readsTier(tier.when)) {
      problems.push(
        `matrix: tier "${tier.id}" contains a { "tier": ... } condition — the tier is not known while tiers are being resolved, so this rule could never fire`,
      );
    }
  }

  for (const rec of matrix.recommendations) {
    const where = `matrix: recommendation "${rec.id}"`;

    if (!domainIds.has(rec.domainId)) {
      problems.push(
        `${where} has domainId "${rec.domainId}", which does not exist`,
      );
    }

    for (const id of rec.workshopIds) {
      if (!workshopIds.has(id)) {
        problems.push(
          `${where} routes to workshop "${id}", which does not exist`,
        );
        continue;
      }
      const workshop = workshops.workshops.find((w) => w.id === id);
      if (workshop?.neverRecommend) {
        problems.push(
          `${where} routes to workshop "${id}", which is marked neverRecommend`,
        );
      }
    }

    for (const id of rec.discussionGroupIds) {
      if (!groupIds.has(id)) {
        problems.push(
          `${where} routes to discussion group "${id}", which does not exist`,
        );
      }
    }

    for (const id of rec.excludes) {
      if (!recommendationIds.has(id)) {
        problems.push(`${where} excludes "${id}", which does not exist`);
      }
      if (id === rec.id) {
        problems.push(`${where} excludes itself`);
      }
    }

    for (const tierId of rec.allowedTiers ?? []) {
      if (!tierIds.has(tierId)) {
        problems.push(
          `${where} is allowed at tier "${tierId}", which does not exist`,
        );
      }
    }

    problems.push(
      ...conditionProblems(rec.when, where, questionIds, domainIds, gateIds),
    );
  }

  const defaultPrimary = matrix.recommendations.find(
    (r) => r.id === matrix.defaultPrimary,
  );
  if (!defaultPrimary) {
    problems.push(
      `matrix: defaultPrimary "${matrix.defaultPrimary}" is not a recommendation`,
    );
  } else {
    if (!defaultPrimary.eligibleAs.includes('primary')) {
      problems.push(
        `matrix: defaultPrimary "${defaultPrimary.id}" is not primary-eligible, so a family matching no primary rule would receive no primary recommendation`,
      );
    }
    if (defaultPrimary.allowedTiers) {
      problems.push(
        `matrix: defaultPrimary "${defaultPrimary.id}" is tier-gated (${defaultPrimary.allowedTiers.join(', ')}) — the fallback must be available at every tier`,
      );
    }
  }

  for (const gate of matrix.tierGates) {
    for (const id of gate.workshopIds) {
      if (!workshopIds.has(id)) {
        problems.push(
          `matrix: tierGate forbids workshop "${id}", which does not exist`,
        );
      }
    }
    for (const tierId of gate.forbiddenAtTiers) {
      if (!tierIds.has(tierId)) {
        problems.push(
          `matrix: tierGate names tier "${tierId}", which does not exist`,
        );
      }
    }
  }

  // A recommendation gated to tiers, whose rule also tests the tier, is a
  // contradiction waiting to happen — but a legitimate one when they agree, so
  // it is only reported when they cannot both hold.
  for (const rec of matrix.recommendations) {
    if (!rec.allowedTiers) continue;
    const tested = testedTiers(rec.when);
    if (tested.length === 0) continue;
    if (!tested.some((t) => rec.allowedTiers!.includes(t))) {
      problems.push(
        `matrix: recommendation "${rec.id}" is allowed only at ${rec.allowedTiers.join(', ')} but its rule tests for ${tested.join(', ')} — it can never fire`,
      );
    }
  }

  // A recommendation whose every workshop is gated at a tier it is allowed at
  // would produce a priority area with no resource to cite — and the methodology
  // requires every priority area to end in a named workshop or group.
  for (const rec of matrix.recommendations) {
    if (rec.workshopIds.length === 0 && rec.discussionGroupIds.length === 0) {
      warnings.push(
        `matrix: recommendation "${rec.id}" routes to no workshop and no discussion group — the methodology expects every priority area to end in a named resource`,
      );
      continue;
    }
    for (const tierId of rec.allowedTiers ?? [...tierIds]) {
      const forbidden = forbiddenAtTier(matrix, tierId);
      const survivors = rec.workshopIds.filter((id) => !forbidden.has(id));
      if (
        rec.workshopIds.length > 0 &&
        survivors.length === 0 &&
        rec.discussionGroupIds.length === 0
      ) {
        problems.push(
          `matrix: recommendation "${rec.id}" has every workshop tier-gated at "${tierId}" and no discussion group to fall back on — it would produce a priority area with no resource`,
        );
      }
    }
  }

  // ------------------------------------------------------------------ sections

  const keys = new Set<string>();
  for (const section of sections.sections) {
    if (keys.has(section.key)) {
      problems.push(`sections: duplicate key "${section.key}"`);
    }
    keys.add(section.key);

    for (const tierId of section.appliesAtTiers ?? []) {
      if (!tierIds.has(tierId)) {
        problems.push(
          `sections: "${section.key}" applies at tier "${tierId}", which does not exist`,
        );
      }
    }
    if (section.when) {
      problems.push(
        ...conditionProblems(
          section.when,
          `sections: "${section.key}"`,
          questionIds,
          domainIds,
          gateIds,
        ),
      );
    }
  }

  const orders = sections.sections.map((s) => s.order);
  if (new Set(orders).size !== orders.length) {
    problems.push(
      'sections: duplicate order values — the report would render in an arbitrary order',
    );
  }

  // --------------------------------------------------------------------- voice

  for (const rule of voice.rules) {
    for (const tierId of rule.appliesAtTiers ?? []) {
      if (!tierIds.has(tierId)) {
        problems.push(
          `voice: rule "${rule.id}" applies at tier "${tierId}", which does not exist`,
        );
      }
    }
  }

  // A banned term that occurs inside an approved resource title or a required
  // sentence would fire on every correctly-written report. The checker strips
  // those before matching, so this is a warning rather than an error — but it is
  // worth knowing which terms depend on that stripping to be usable at all.
  const approvedText = [
    ...workshops.workshops.map((w) => w.title),
    ...workshops.discussionGroups.map((g) => g.name),
    ...workshops.requiredWording.flatMap((r) => [
      ...r.sentences.en,
      ...r.sentences.es,
    ]),
  ]
    .join('\n')
    .toLowerCase();

  const collisions = voice.rules.flatMap((rule) =>
    [...rule.terms.en, ...rule.terms.es]
      .filter((term) => approvedText.includes(term.toLowerCase()))
      .map((term) => `${rule.id}:"${term}"`),
  );
  if (collisions.length > 0) {
    warnings.push(
      `voice: ${collisions.length} banned term(s) also occur inside approved resource titles or required wording (${collisions.join(', ')}). The checker strips those before matching; without that they would flag every correct report.`,
    );
  }

  // ------------------------------------------------------------------- status

  if (assessment.status !== 'approved') {
    warnings.push(
      `assessment: status is "${assessment.status}" — content is not founder-approved yet`,
    );
  }
  if (matrix.status !== 'approved') {
    warnings.push(
      `matrix: status is "${matrix.status}" — routing is not founder-approved yet. Every report generated now is provisional.`,
    );
  }

  return { problems, warnings };
}

const testedTiers = (condition: Condition): string[] => {
  if ('all' in condition) return condition.all.flatMap(testedTiers);
  if ('any' in condition) return condition.any.flatMap(testedTiers);
  if ('not' in condition) return [];
  return 'tier' in condition ? condition.tier : [];
};

function forbiddenAtTier(
  matrix: RecommendationMatrix,
  tierId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const gate of matrix.tierGates) {
    if (!gate.forbiddenAtTiers.includes(tierId)) continue;
    for (const id of gate.workshopIds) ids.add(id);
  }
  return ids;
}

const isCatchAll = (condition: Condition): boolean =>
  'always' in condition && condition.always === true;

const readsTier = (condition: Condition): boolean => {
  if ('all' in condition) return condition.all.some(readsTier);
  if ('any' in condition) return condition.any.some(readsTier);
  if ('not' in condition) return readsTier(condition.not);
  return 'tier' in condition;
};

/**
 * Walks a condition tree and reports every reference that cannot resolve.
 *
 * This is the check that matters most. A rule reading a question id that does
 * not exist evaluates to false forever: it never fires, nothing crashes, and a
 * family quietly never receives the recommendation the methodology says they
 * should. That failure is invisible in production and obvious here.
 */
function conditionProblems(
  condition: Condition,
  where: string,
  questionIds: Set<string>,
  domainIds: Set<string>,
  gates: Map<string, { options: { value: string }[] }>,
): string[] {
  const problems: string[] = [];

  const walk = (node: Condition): void => {
    if ('all' in node) return node.all.forEach(walk);
    if ('any' in node) return node.any.forEach(walk);
    if ('not' in node) return walk(node.not);

    if ('question' in node && !questionIds.has(node.question)) {
      problems.push(
        `${where} reads question "${node.question}", which does not exist — this rule would never fire`,
      );
    }
    if ('domainScore' in node && !domainIds.has(node.domainScore)) {
      problems.push(
        `${where} reads domain "${node.domainScore}", which does not exist — this rule would never fire`,
      );
    }
    if ('questionAverage' in node) {
      for (const id of node.questionAverage) {
        if (!questionIds.has(id)) {
          problems.push(
            `${where} averages question "${id}", which does not exist — this rule would never fire`,
          );
        }
      }
    }
    if ('questionValueCount' in node) {
      for (const id of node.questionValueCount.questions) {
        if (!questionIds.has(id)) {
          problems.push(
            `${where} counts question "${id}", which does not exist — this rule would never fire`,
          );
        }
      }
    }
    if ('gate' in node) {
      const gate = gates.get(node.gate);
      if (!gate) {
        problems.push(
          `${where} reads gate "${node.gate}", which does not exist — this rule would never fire`,
        );
      } else {
        const valid = new Set(gate.options.map((o) => o.value));
        for (const value of node.in) {
          if (!valid.has(value)) {
            problems.push(
              `${where} tests gate "${node.gate}" for "${value}", which is not one of its options — this rule would never fire`,
            );
          }
        }
      }
    }
  };

  walk(condition);
  return problems;
}

/**
 * Checks the prompt templates against the placeholder contract.
 *
 * Both directions matter. An unknown placeholder ships the literal string
 * `{{RESOURCES}}` to the model. A missing one is worse: the prompt still reads
 * like a valid instruction, the model still returns a plausible plan, and
 * nothing anywhere reports that the plan was written without this family's
 * answers in front of it.
 */
export function validateTemplates(templates: PromptTemplates): string[] {
  const problems: string[] = [];
  const known = new Set<string>(PROMPT_PLACEHOLDERS);

  for (const kind of ['system', 'user'] as const) {
    for (const language of LANGUAGES) {
      const text = templates[kind][language];
      const where = `${kind}.${language}.md`;

      const used = new Set(
        [...text.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]),
      );
      for (const placeholder of used) {
        if (!known.has(placeholder)) {
          problems.push(
            `${where}: uses {{${placeholder}}}, which the prompt builder cannot fill — it would reach the model as literal text`,
          );
        }
      }

      if (kind === 'user') {
        for (const placeholder of REQUIRED_USER_PLACEHOLDERS) {
          if (!used.has(placeholder)) {
            problems.push(
              `${where}: is missing {{${placeholder}}} — the plan would be written without it and would still read fine, which is why this is fatal`,
            );
          }
        }
      }
    }
  }

  return problems;
}
