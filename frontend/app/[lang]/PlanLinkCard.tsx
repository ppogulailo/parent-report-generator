'use client';

import { useState } from 'react';

/**
 * The saved-plan card: everything about KEEPING the plan, in one place at the
 * top of the results. One primary action (PDF), one secondary (print), the
 * link with its copy affordance, and the destructive pair demoted behind a
 * divider as muted text buttons — because the card now sits where accidental
 * clicks happen, and "Delete my data" must read nothing like "Download PDF".
 *
 * Strings arrive via `copy`, the same pattern as ReportView: every caller owns
 * its bilingual strings, and nothing in here is hardcoded English.
 */

export interface PlanLinkCardCopy {
  label: string;
  /** The retention notice, with the duration emphasised — not the sentence. */
  noteBefore: string;
  noteEmphasis: string;
  noteAfter: string;
  copyLink: string;
  copied: string;
  /** aria-live announcement after a successful copy. */
  copiedAnnouncement: string;
  downloadPdf: string;
  print: string;
  deleteData: string;
  deleteConfirm: string;
  /** Optional second muted action ("Start over" on the results screen). */
  secondaryDestructive?: string;
}

export default function PlanLinkCard({
  planUrl,
  pdfHref,
  copy,
  onDelete,
  onSecondaryDestructive,
}: {
  planUrl: string;
  /** Null hides the PDF button (capability off) — print remains. */
  pdfHref: string | null;
  copy: PlanLinkCardCopy;
  onDelete: () => void;
  onSecondaryDestructive?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <section className="plan-link-card no-print" aria-label={copy.label}>
      <p className="plan-link-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
        {copy.label}
      </p>

      <p className="plan-link-note">
        {copy.noteBefore}
        <strong>{copy.noteEmphasis}</strong>
        {copy.noteAfter}
      </p>

      <div className="plan-link-row">
        <span className="plan-link-url" title={planUrl}>
          {planUrl}
        </span>
        <button
          type="button"
          className={`plan-link-copy${copied ? ' copied' : ''}`}
          onClick={() => {
            void navigator.clipboard
              .writeText(planUrl)
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => {
                /* the link is visible to copy by hand */
              });
          }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
          {copied ? copy.copied : copy.copyLink}
        </button>
        {/* Screen readers hear the confirmation without the button re-reading. */}
        <span className="visually-hidden" aria-live="polite">
          {copied ? copy.copiedAnnouncement : ''}
        </span>
      </div>

      <div className="plan-link-actions">
        {pdfHref ? (
          <a className="btn btn-primary" href={pdfHref}>
            <span>{copy.downloadPdf}</span>
          </a>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.print()}
        >
          <span>{copy.print}</span>
        </button>
      </div>

      <hr className="plan-link-divider" />

      <div className="plan-link-danger-row">
        <button
          type="button"
          className="plan-link-textbtn danger"
          onClick={() => {
            if (window.confirm(copy.deleteConfirm)) onDelete();
          }}
        >
          {copy.deleteData}
        </button>
        {copy.secondaryDestructive && onSecondaryDestructive ? (
          <button
            type="button"
            className="plan-link-textbtn"
            onClick={onSecondaryDestructive}
          >
            {copy.secondaryDestructive}
          </button>
        ) : null}
      </div>
    </section>
  );
}
