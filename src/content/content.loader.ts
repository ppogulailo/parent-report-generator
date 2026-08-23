import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { assessmentSchema } from './schemas/assessment.schema';
import { matrixSchema } from './schemas/matrix.schema';
import { sectionsSchema } from './schemas/sections.schema';
import { voiceSchema } from './schemas/voice.schema';
import { workshopsSchema } from './schemas/workshops.schema';
import { validateContent, validateTemplates } from './content.validate';
import {
  ContentBundle,
  ContentValidationError,
  LANGUAGES,
  PromptTemplates,
} from './content.types';

/**
 * Reads and validates `content/`.
 *
 * Called once at boot. Any failure throws and the app does not start — a parent
 * mid-assessment is the worst moment to discover a broken routing rule.
 */

/** Keys beginning with `_` are comments for whoever reads the file next. They
 *  are stripped before validation so the schemas can stay `.strict()`, which is
 *  what makes a misspelled key fail loudly instead of being ignored. */
function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !key.startsWith('_'))
        .map(([key, val]) => [key, stripComments(val)]),
    );
  }
  return value;
}

function readJson<T>(dir: string, file: string, schema: ZodType<T>): T {
  const path = join(dir, file);

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ContentValidationError([`${file}: cannot be read at ${path}`]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ContentValidationError([
      `${file}: is not valid JSON — ${(err as Error).message}`,
    ]);
  }

  const result = schema.safeParse(stripComments(parsed));
  if (!result.success) {
    throw new ContentValidationError(
      result.error.issues.map(
        (issue) =>
          `${file}: ${issue.path.join('.') || '(root)'} — ${issue.message}`,
      ),
    );
  }
  return result.data;
}

function readTemplates(dir: string): PromptTemplates {
  const templates = { system: {}, user: {} } as PromptTemplates;
  const problems: string[] = [];

  for (const kind of ['system', 'user'] as const) {
    for (const language of LANGUAGES) {
      const file = `${kind}.${language}.md`;
      const path = join(dir, 'report-templates', file);
      try {
        const text = readFileSync(path, 'utf8');
        if (text.trim().length === 0) {
          problems.push(`${file}: is empty`);
          continue;
        }
        templates[kind][language] = text;
      } catch {
        problems.push(`${file}: cannot be read at ${path}`);
      }
    }
  }

  if (problems.length > 0) throw new ContentValidationError(problems);
  return templates;
}

export function loadContent(dir: string): ContentBundle {
  const assessment = readJson(dir, 'assessment.json', assessmentSchema);
  const workshops = readJson(dir, 'workshops.json', workshopsSchema);
  const matrix = readJson(dir, 'recommendation-matrix.json', matrixSchema);
  const sections = readJson(
    join(dir, 'report-templates'),
    'sections.json',
    sectionsSchema,
  );

  const voice = readJson(dir, 'voice.json', voiceSchema);
  const templates = readTemplates(dir);

  const { problems, warnings } = validateContent({
    assessment,
    workshops,
    matrix,
    sections,
    voice,
  });
  problems.push(...validateTemplates(templates));

  if (problems.length > 0) throw new ContentValidationError(problems);

  return {
    assessment,
    workshops,
    matrix,
    sections,
    voice,
    templates,
    warnings,
  };
}

/** `CONTENT_DIR` exists so tests can point at a fixture bundle. Production never
 *  sets it and loads the shipped `content/`. */
export const resolveContentDir = (): string =>
  process.env.CONTENT_DIR ?? join(process.cwd(), 'content');
