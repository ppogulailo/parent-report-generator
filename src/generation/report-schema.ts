import { z } from 'zod';
import type { ReportSectionConfig } from '../content/schemas/sections.schema';
import type { SelectionResult } from '../selection/selection.types';

/**
 * Builds the schema the model's response must satisfy, from the sections that
 * apply to this report and the ids the matrix selected.
 *
 * **This is where "the matrix selects, the model writes" stops being a policy
 * and becomes a fact.** The recommendation and workshop ids are not merely
 * suggested to the model — the schema requires exactly the selected set, so a
 * response that adds one, drops one or substitutes one fails validation and the
 * request is retried with the error fed back.
 *
 * Two further properties matter:
 *
 *   · The object is `.strict()`. A key the model invents fails. That is what
 *     makes a `static` section a guarantee: it is absent from this schema, so a
 *     model that tries to write the Universal Guiding Principle in its own words
 *     is rejected rather than quietly overriding approved copy.
 *
 *   · Every string is `.min(1)`. An empty section is a hole in a parent's plan,
 *     and the live system produces exactly that whenever the model words a
 *     heading differently from the parser's expectation. Here it cannot ship.
 */

export interface ReportSchemaResult {
  schema: z.ZodType<Record<string, unknown>>;
  /** The keys the model is expected to return, for the prompt skeleton. */
  keys: string[];
}

/** Sections the model actually writes — everything except `static`. */
export const writtenSections = (
  sections: ReportSectionConfig[],
): ReportSectionConfig[] => sections.filter((s) => s.type !== 'static');

/**
 * Requires an array whose ids are exactly `expected`, once each.
 *
 * Order is not enforced here. The service reorders to the matrix's ranking
 * before rendering, because a model that returns the right set in a different
 * order has not made a methodology error and failing it would burn a retry for
 * nothing.
 */
function exactIds<T extends z.ZodRawShape>(
  itemShape: T,
  idKey: keyof T & string,
  expected: string[],
  label: string,
) {
  return z.array(z.object(itemShape).strict()).superRefine((items, ctx) => {
    const actual = items.map(
      (item) => (item as Record<string, unknown>)[idKey] as string,
    );

    const duplicates = actual.filter((id, i) => actual.indexOf(id) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label}: repeated ${idKey} ${[...new Set(duplicates)].join(', ')} — each must appear exactly once`,
      });
    }

    const missing = expected.filter((id) => !actual.includes(id));
    const invented = actual.filter((id) => !expected.includes(id));

    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label}: missing ${missing.join(', ')} — every one selected must be written about, none omitted`,
      });
    }
    if (invented.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label}: ${invented.join(', ')} was not selected for this family and must not appear. Use only: ${expected.join(', ')}`,
      });
    }
  });
}

export function buildReportSchema(
  sections: ReportSectionConfig[],
  selection: SelectionResult,
): ReportSchemaResult {
  const written = writtenSections(sections);

  const recommendationIds = [
    selection.primary.id,
    ...selection.supporting.map((s) => s.id),
  ];

  const shape: z.ZodRawShape = {};

  for (const section of written) {
    switch (section.type) {
      case 'prose':
        shape[section.key] = z.string().min(1);
        break;

      case 'list': {
        const [min, max] = section.listRange ?? [1, 10];
        shape[section.key] = z.array(z.string().min(1)).min(min).max(max);
        break;
      }

      case 'recommendationList':
        shape[section.key] = exactIds(
          {
            recommendationId: z.string().min(1),
            headline: z.string().min(1),
            body: z.string().min(1),
          },
          'recommendationId',
          recommendationIds,
          section.key,
        );
        break;

      case 'workshopList':
        shape[section.key] = exactIds(
          {
            workshopId: z.string().min(1),
            whyThisFamily: z.string().min(1),
          },
          'workshopId',
          selection.workshopIds,
          section.key,
        );
        break;

      case 'static':
        // Unreachable: stripped by writtenSections above. The case exists so
        // that adding a new section type without handling it fails to compile
        // rather than silently producing a schema with a missing key.
        break;
    }
  }

  return {
    schema: z.object(shape).strict() as unknown as z.ZodType<
      Record<string, unknown>
    >,
    keys: written.map((s) => s.key),
  };
}
