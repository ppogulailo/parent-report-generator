import type { Comparator, Condition } from '../content/schemas/rule.schema';
import type { ScoredSubmission } from './selection.types';

/**
 * Evaluates a condition from the recommendation matrix against a scored
 * submission. Pure, synchronous, and total — every condition returns a boolean.
 *
 * This is the whole reason the matrix can be data: the approved methodology is
 * expressed as condition trees in JSON and this function is the only thing that
 * interprets them.
 */

/**
 * Applies whichever comparators are present. All present comparators must pass —
 * `{ "gte": 2, "lte": 3 }` means a range, not a choice.
 *
 * Unknown domains and unanswered questions arrive here as `undefined`, and an
 * undefined value fails every comparator. That is deliberate: a rule about a
 * question that was not answered should not fire.
 */
export function compare(
  value: number | undefined,
  comparator: Comparator,
): boolean {
  if (value === undefined || Number.isNaN(value)) return false;

  if (comparator.gt !== undefined && !(value > comparator.gt)) return false;
  if (comparator.gte !== undefined && !(value >= comparator.gte)) return false;
  if (comparator.lt !== undefined && !(value < comparator.lt)) return false;
  if (comparator.lte !== undefined && !(value <= comparator.lte)) return false;
  if (comparator.eq !== undefined && value !== comparator.eq) return false;
  if (comparator.in !== undefined && !comparator.in.includes(value))
    return false;

  return true;
}

/**
 * The question ids inside a condition that actually contributed to it matching.
 *
 * This is what lets a report say *why* a family received a priority area, in
 * terms of what they themselves reported: "the secrecy you described" rather
 * than "your Communication & Conflict score". The prompt builder passes these
 * to the model as the evidence for each recommendation, so the link between an
 * answer and the advice that follows from it is structural rather than something
 * the model is asked to infer.
 *
 * Only branches that hold are walked. A `not` branch contributes nothing: the
 * absence of a signal is not evidence a parent can be shown.
 */
export function evidenceFor(
  condition: Condition,
  scored: ScoredSubmission,
): string[] {
  if (!evaluate(condition, scored)) return [];

  const ids: string[] = [];
  const walk = (node: Condition): void => {
    if ('all' in node) return node.all.forEach(walk);
    if ('any' in node) {
      // Only the branches that actually fired are evidence.
      for (const child of node.any) {
        if (evaluate(child, scored)) walk(child);
      }
      return;
    }
    if ('not' in node) return;
    if ('question' in node) ids.push(node.question);
    if ('questionAverage' in node) ids.push(...node.questionAverage);
    if ('questionValueCount' in node) {
      // Only the questions actually sitting at the value, not the whole subset.
      ids.push(
        ...node.questionValueCount.questions.filter(
          (id) =>
            scored.normalisedResponses[id] === node.questionValueCount.value,
        ),
      );
    }
  };
  walk(condition);

  return [...new Set(ids)];
}

export function evaluate(
  condition: Condition,
  scored: ScoredSubmission,
): boolean {
  if ('all' in condition) {
    return condition.all.every((c: Condition) => evaluate(c, scored));
  }
  if ('any' in condition) {
    return condition.any.some((c: Condition) => evaluate(c, scored));
  }
  if ('not' in condition) {
    return !evaluate(condition.not, scored);
  }
  if ('always' in condition) {
    return condition.always;
  }
  if ('urgentTextPresent' in condition) {
    return scored.urgentTextPresent === condition.urgentTextPresent;
  }
  if ('tier' in condition) {
    // Undefined while tiers are being resolved, so a tier rule that reads the
    // tier matches nothing. Boot validation rejects that content outright; this
    // is the behaviour if one ever slipped through.
    return (
      scored.tierId !== undefined && condition.tier.includes(scored.tierId)
    );
  }
  if ('gate' in condition) {
    const answer = scored.gateAnswers[condition.gate];
    // An unanswered gate matches nothing. A gate is always optional, and
    // treating "no answer" as any particular answer would be us deciding
    // something the parent did not tell us.
    return answer !== undefined && condition.in.includes(answer);
  }
  if ('overallAverage' in condition) {
    return compare(scored.overallAverage, condition.overallAverage);
  }
  if ('answeredCount' in condition) {
    const { value, ...comparator } = condition.answeredCount;
    return compare(scored.valueCounts[value] ?? 0, comparator);
  }
  if ('questionAverage' in condition) {
    const { questionAverage, ...comparator } = condition;
    const values = questionAverage.map((id) => scored.normalisedResponses[id]);
    // A subset naming a question that does not exist is a content error, not a
    // condition that should quietly evaluate false. Boot validation rejects it;
    // this guard is what makes that validation possible to write.
    if (values.some((v) => v === undefined)) return false;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return compare(mean, comparator);
  }
  if ('questionValueCount' in condition) {
    const { questionValueCount, ...comparator } = condition;
    const count = questionValueCount.questions.filter(
      (id) => scored.normalisedResponses[id] === questionValueCount.value,
    ).length;
    return compare(count, comparator);
  }
  if ('domainScore' in condition) {
    const { domainScore, ...comparator } = condition;
    return compare(scored.domainScores[domainScore], comparator);
  }
  if ('question' in condition) {
    const { question, ...comparator } = condition;
    return compare(scored.normalisedResponses[question], comparator);
  }

  // Unreachable: the Zod union rejects anything else at boot. Present so a
  // future condition type added to the schema but not here fails loudly rather
  // than silently evaluating false, which would quietly stop a rule from ever
  // firing.
  throw new Error(
    `unhandled condition shape: ${JSON.stringify(condition)} — add a branch to evaluate()`,
  );
}
