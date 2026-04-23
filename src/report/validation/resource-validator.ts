import {
  ARTICLES_OF_ACTION,
  AUXILIARY_WORKSHOPS,
  DISCUSSION_GROUPS,
} from '../prompts/resources';
import { ReportSections } from '../interfaces/report.interface';

export type ResourceWarning = {
  kind: 'article' | 'workshop' | 'discussion-group' | 'chapter-citation';
  detail: string;
};

const ARTICLE_TITLES = new Set(ARTICLES_OF_ACTION.map(normaliseForCompare));
const WORKSHOP_TITLES = new Set(
  AUXILIARY_WORKSHOPS.map((w) => normaliseForCompare(w.title)),
);
const GROUP_TITLES = new Set(DISCUSSION_GROUPS.map(normaliseForCompare));

const CHAPTER_PATTERN = /\bchapter\s+\d+/i;

const ARTICLE_CITE = /Article(?:s)? of Action[^\n.:]*[:—-]\s*["“]?([^\n"”.]+)/gi;
const WORKSHOP_CITE = /(?:Auxiliary )?Workshop[^\n.:]*[:—-]\s*["“]?([^\n"”.]+)/gi;
const GROUP_CITE = /(?:ASAP )?Discussion Group[^\n.:]*[:—-]\s*["“]?([^\n"”.]+)/gi;

function normaliseForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function checkCitations(
  text: string,
  pattern: RegExp,
  valid: Set<string>,
  kind: ResourceWarning['kind'],
): ResourceWarning[] {
  const warnings: ResourceWarning[] = [];
  const matches = text.matchAll(pattern);
  for (const m of matches) {
    const candidate = (m[1] ?? '').trim();
    if (!candidate) continue;
    const normalised = normaliseForCompare(candidate);
    const matchesAny = [...valid].some(
      (v) => normalised === v || normalised.startsWith(v) || v.startsWith(normalised),
    );
    if (!matchesAny) {
      warnings.push({ kind, detail: candidate });
    }
  }
  return warnings;
}

export function validateReportResources(
  report: ReportSections,
): ResourceWarning[] {
  const fullText = Object.values(report).join('\n\n');
  const warnings: ResourceWarning[] = [];

  warnings.push(...checkCitations(fullText, ARTICLE_CITE, ARTICLE_TITLES, 'article'));
  warnings.push(...checkCitations(fullText, WORKSHOP_CITE, WORKSHOP_TITLES, 'workshop'));
  warnings.push(...checkCitations(fullText, GROUP_CITE, GROUP_TITLES, 'discussion-group'));

  if (CHAPTER_PATTERN.test(fullText)) {
    const m = fullText.match(CHAPTER_PATTERN);
    warnings.push({
      kind: 'chapter-citation',
      detail: m ? m[0] : 'chapter reference',
    });
  }

  return warnings;
}
