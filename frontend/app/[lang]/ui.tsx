/**
 * Shared presentation pieces: the icons and the severity palette.
 *
 * `client.tsx` still carries its own copies. They are not shared from here
 * because that file serves live traffic and is slated for deletion once the
 * questionnaire migrates — a refactor of it buys nothing and risks the flow
 * parents are using today. When it goes, its copies go with it.
 */

/** 1→4 severity swatch colours (green → olive → orange → red). */
export const SEV_COLORS = ['#2f9e57', '#8a9a3c', '#c07a12', '#cf5a2c'];

/** Tier surface/foreground pairs, keyed by the matrix's tier ids. */
export const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  mild: { bg: 'var(--positive-surface)', fg: 'var(--positive)' },
  moderate: { bg: 'var(--warning-surface)', fg: 'var(--warning)' },
  serious: { bg: 'var(--negative-surface)', fg: 'var(--negative)' },
  // Critical is the urgent form of Serious and reads the same, deliberately:
  // the plan is written in the same register.
  critical: { bg: 'var(--negative-surface)', fg: 'var(--negative)' },
};

/** Domain-score bar colour, on the same thresholds the severity gate uses. */
export function barColorFor(score: number): string {
  if (score < 2) return SEV_COLORS[0];
  if (score < 2.75) return SEV_COLORS[1];
  if (score < 3.4) return SEV_COLORS[2];
  return SEV_COLORS[3];
}

export const CheckIcon = ({
  size = 11,
  stroke = 'currentColor',
}: {
  size?: number;
  stroke?: string;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 12.5 9.5 18 20 6"
      stroke={stroke}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WarningIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 9v4m0 4h.01M10.3 3.86 1.8 18a1.5 1.5 0 0 0 1.3 2.25h17.8A1.5 1.5 0 0 0 22.2 18L13.7 3.86a1.5 1.5 0 0 0-2.6 0Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <svg
    className="spinner"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2.5"
      opacity="0.25"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

export const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

export const BrandMark = () => (
  <svg className="brand-mark" viewBox="284 34 112 112" role="img" aria-hidden>
    <g transform="translate(340,78)">
      <path
        d="M -46 26 L 0 -14 L 46 26"
        fill="none"
        stroke="#4a8f8c"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 0 8 C -6 -2 -20 -1 -20 11 C -20 22 -8 30 0 38 C 8 30 20 22 20 11 C 20 -1 6 -2 0 8 Z"
        fill="#e8a04b"
      />
    </g>
  </svg>
);
