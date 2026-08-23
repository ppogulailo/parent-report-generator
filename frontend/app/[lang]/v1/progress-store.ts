/**
 * Saves a parent's place in the questionnaire, in this browser only.
 *
 * The banner says "Nothing was sent anywhere" and that has to stay true: this
 * writes to `localStorage` and nowhere else.
 *
 * **The urgent-concern note is deliberately NOT saved.** It is the most
 * sensitive thing a parent types here — a description of what they suspect their
 * child is doing — and this assessment is often filled in on a family computer.
 * Restoring it into a visible textarea for whoever opens the page next, possibly
 * the child, is a real harm; losing it on a refresh is an inconvenience. If ASAP
 * decides otherwise, that is a deliberate call, not a default.
 */

const KEY = 'mi-v1-progress';

export interface SavedProgress {
  /** Answers keyed by question id. */
  responses: Record<string, number>;
  /** Non-scored gate answers. */
  gates: Record<string, string>;
  /** The assessment version these answers were given against. */
  assessmentVersion: string;
  savedAt: number;
}

export function loadProgress(validQuestionIds: string[]): SavedProgress | null {
  if (typeof window === 'undefined') return null;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt or unreadable: treat it as absent rather than throwing on a page
    // a worried parent is trying to open.
    return null;
  }

  const candidate = parsed as Partial<SavedProgress> | null;
  if (!candidate || typeof candidate !== 'object') return null;

  const valid = new Set(validQuestionIds);
  const responses: Record<string, number> = {};
  for (const [id, value] of Object.entries(candidate.responses ?? {})) {
    // Answers to questions that no longer exist are dropped rather than sent.
    // The questionnaire is content now, so a question CAN disappear between one
    // visit and the next, and a stale id would fail validation on submit.
    if (valid.has(id) && typeof value === 'number') responses[id] = value;
  }

  const gates: Record<string, string> = {};
  for (const [id, value] of Object.entries(candidate.gates ?? {})) {
    if (typeof value === 'string') gates[id] = value;
  }

  if (Object.keys(responses).length === 0) return null;

  return {
    responses,
    gates,
    assessmentVersion:
      typeof candidate.assessmentVersion === 'string'
        ? candidate.assessmentVersion
        : 'unknown',
    savedAt: typeof candidate.savedAt === 'number' ? candidate.savedAt : 0,
  };
}

export function saveProgress(
  responses: Record<string, number>,
  gates: Record<string, string>,
  assessmentVersion: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(responses).length === 0) {
      window.localStorage.removeItem(KEY);
      return;
    }
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        responses,
        gates,
        assessmentVersion,
        savedAt: Date.now(),
      } satisfies SavedProgress),
    );
  } catch {
    // Private browsing, a full quota, or storage disabled. Saving a place is a
    // convenience; failing to save it must never stop someone answering.
  }
}

export function clearProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as above.
  }
}
