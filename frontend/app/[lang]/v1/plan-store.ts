/**
 * Remembers WHERE a parent's saved plan lives — never what is in it.
 *
 * The record is a pointer: the plan id and when it was made. The plan itself
 * stays on the server behind its private link, and this pointer is what lets
 * the landing page offer "your plan is still here" on a return visit. Cleared
 * when the parent deletes their data, and ignored once the 90-day retention
 * window has passed — the server would refuse the id anyway, and offering a
 * link we know is dead is worse than offering nothing.
 */

const KEY = 'mi-v1-plan';

const NINETY_DAYS_MS = 90 * 86_400_000;

export interface SavedPlanPointer {
  planId: string;
  language: 'en' | 'es';
  savedAt: number;
}

export function savePlanPointer(pointer: SavedPlanPointer): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pointer));
  } catch {
    /* storage unavailable — the parent just keeps their link instead */
  }
}

export function loadPlanPointer(): SavedPlanPointer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPlanPointer> | null;
    if (
      !parsed ||
      typeof parsed.planId !== 'string' ||
      typeof parsed.savedAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > NINETY_DAYS_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed as SavedPlanPointer;
  } catch {
    return null;
  }
}

export function clearPlanPointer(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
