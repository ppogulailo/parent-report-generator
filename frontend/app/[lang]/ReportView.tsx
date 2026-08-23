'use client';

import { useState } from 'react';
import {
  CheckIcon,
  ChevronRight,
  Spinner,
  TIER_COLORS,
  WarningIcon,
  barColorFor,
} from './ui';

/**
 * Renders a Version 1.0 plan in the existing design.
 *
 * Every class here already exists in `globals.css` and is what the live
 * questionnaire uses — `results`, `level-card`, `results-group`, `domain-card`,
 * `scard`. The plan arrives structured rather than as one block of streamed
 * text, which is what lets a workshop carry a link and a priority area carry its
 * own heading, but it should look like the same product.
 *
 * Section types map to shapes rather than to hard-coded keys, so adding a
 * section in `content/report-templates/sections.json` renders here without a
 * frontend change.
 */

export type SectionType =
  | 'prose'
  | 'list'
  | 'recommendationList'
  | 'workshopList'
  | 'static';

export interface ReportSection {
  key: string;
  order: number;
  type: SectionType;
  title: string;
  body?: string;
  items?: string[];
  recommendations?: {
    recommendationId: string;
    title: string;
    headline: string;
    body: string;
  }[];
  workshops?: {
    workshopId: string;
    title: string;
    category: string;
    url: string | null;
    whyThisFamily: string;
  }[];
}

export interface ReportSeverity {
  tierId: string;
  label: string;
  description: string;
}

interface Props {
  sections: ReportSection[];
  severity: ReportSeverity | null;
  domainScores: Record<string, number> | null;
  /** Domain descriptions keyed by the same label the scores use, so an expanded
   *  card explains what the area means rather than opening onto nothing. */
  domainDescriptions: Record<string, string>;
  topDomains: string[];
  language: 'en' | 'es';
  /** True while the model is still writing. Sections with no content yet show a
   *  placeholder and a cursor rather than an empty card. */
  writing?: boolean;
  copy: {
    writingPlaceholder: string;
    planLevelLabel: string;
    domainScoresHeading: string;
    domainScoresHint: string;
    topPrioritiesHeading: string;
    actionPlanHeading: string;
    readyHeading: string;
    readySub: string;
    writingHeading: string;
    writingSub: string;
    workshopsUnlinked: string;
    openWorkshop: string;
  };
}

/** A section the model has not reached yet. Its card is drawn, so the plan's
 *  shape is visible from the first moment, but there is nothing in it. */
function isEmpty(section: ReportSection): boolean {
  return (
    !section.body &&
    !(section.items?.length ?? 0) &&
    !(section.recommendations?.length ?? 0) &&
    // A workshop list with titles in it is not empty, even before the model has
    // written a word about them: the titles and links are content in their own
    // right, and the reason follows.
    !(section.workshops?.length ?? 0)
  );
}

/** Paragraph breaks are the only formatting asked for, so the body is split
 *  rather than parsed. Nothing here interprets markdown — a stray asterisk in a
 *  parent's plan should read as an asterisk. */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p className="section-para" key={index}>
            {paragraph}
          </p>
        ))}
    </>
  );
}

export default function ReportView({
  sections,
  severity,
  domainScores,
  domainDescriptions,
  topDomains,
  writing = false,
  copy,
}: Props) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const tier = severity ? TIER_COLORS[severity.tierId] : undefined;
  const anyWorkshopLinked = ordered.some((s) =>
    s.workshops?.some((w) => w.url !== null),
  );

  return (
    <div className="results" translate="no">
      <section aria-live="polite">
        <div className={`status-card${writing ? ' working' : ' done'}`}>
          {writing ? (
            <Spinner size={22} />
          ) : (
            <span className="status-check" aria-hidden>
              <CheckIcon size={12} />
            </span>
          )}
          <div>
            <p className="status-heading">
              <span>{writing ? copy.writingHeading : copy.readyHeading}</span>
            </p>
            <p className="status-sub">
              <span>{writing ? copy.writingSub : copy.readySub}</span>
            </p>
          </div>
        </div>

        {severity && tier ? (
          <div className="level-card" style={{ background: tier.bg }}>
            <span className="level-tag" style={{ background: tier.fg }}>
              {severity.label}
            </span>
            <div>
              <p className="level-overline" style={{ color: tier.fg }}>
                {copy.planLevelLabel}
              </p>
              <p className="level-desc">{severity.description}</p>
            </div>
          </div>
        ) : null}

        {domainScores ? (
          <>
            <div className="results-group">
              <h3 className="results-group-heading">
                {copy.domainScoresHeading}
              </h3>
              <p className="block-sub" style={{ marginBottom: 14 }}>
                {copy.domainScoresHint}
              </p>
              <div className="scores">
                {Object.entries(domainScores).map(([name, score]) => {
                  const open = expandedDomain === name;
                  const description = domainDescriptions[name];
                  return (
                    <div
                      className={`domain-card${open ? ' open' : ''}`}
                      key={name}
                    >
                      <button
                        type="button"
                        className="domain-card-btn"
                        aria-expanded={open}
                        onClick={() => setExpandedDomain(open ? null : name)}
                      >
                        <span className="domain-chevron">
                          <ChevronRight />
                        </span>
                        {/* Divs, not spans: `.domain-card-track` is 6px tall and
                            an inline element ignores height, which silently
                            renders the score bar as nothing at all. */}
                        <div className="domain-card-main">
                          <div className="domain-card-top">
                            <span className="domain-card-name">{name}</span>
                            <span className="domain-card-score">
                              {score.toFixed(2)}
                            </span>
                          </div>
                          <div className="domain-card-track">
                            <div
                              className="domain-card-fill"
                              style={{
                                // The scale starts at 1, so 1 is an empty bar
                                // and 4 is a full one. Dividing by 4 would show
                                // a quarter-full bar for the healthiest answer.
                                width: `${Math.max(4, ((score - 1) / 3) * 100)}%`,
                                background: barColorFor(score),
                              }}
                            />
                          </div>
                        </div>
                      </button>
                      {open && description ? (
                        <p className="domain-card-desc">{description}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {topDomains.length > 0 ? (
              <div className="results-group">
                <h3 className="results-group-heading">
                  {copy.topPrioritiesHeading}
                </h3>
                <div className="top-domains">
                  {topDomains.map((name, index) => (
                    <div className="top-domain" key={name}>
                      <span className="top-rank">{index + 1}</span>
                      <span className="top-domain-name">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <h3 className="results-group-heading">{copy.actionPlanHeading}</h3>
        <div className="sections">
          {ordered.map((section) => {
            const isUrgent = section.key === 'urgentConcern';
            return (
              <div
                className={`scard${isUrgent ? ' urgent' : ''}`}
                key={section.key}
              >
                <div className="scard-head">
                  {isUrgent ? <WarningIcon size={17} /> : null}
                  <h4 className="scard-title">{section.title}</h4>
                </div>
                <div className="scard-body">
                  {isEmpty(section) ? (
                    <p className="section-placeholder">
                      {writing ? copy.writingPlaceholder : ''}
                    </p>
                  ) : null}

                  {(section.type === 'prose' || section.type === 'static') &&
                  section.body ? (
                    <>
                      <Paragraphs text={section.body} />
                      {writing ? (
                        <span className="cursor" aria-hidden>
                          ▍
                        </span>
                      ) : null}
                    </>
                  ) : null}

                  {section.type === 'list' && section.items ? (
                    <ul className="section-list">
                      {section.items.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : null}

                  {section.type === 'recommendationList' &&
                  section.recommendations
                    ? section.recommendations.map((rec) => (
                        <div className="priority" key={rec.recommendationId}>
                          <p className="priority-area">{rec.title}</p>
                          <h5 className="priority-headline">{rec.headline}</h5>
                          <Paragraphs text={rec.body} />
                        </div>
                      ))
                    : null}

                  {section.type === 'workshopList' && section.workshops ? (
                    <>
                      <div className="workshops">
                        {section.workshops.map((workshop) => (
                          <div className="workshop" key={workshop.workshopId}>
                            <p className="workshop-cat">{workshop.category}</p>
                            {workshop.url ? (
                              <a
                                className="workshop-title workshop-link"
                                href={workshop.url}
                                target="_blank"
                                // noopener is the security half; noreferrer keeps
                                // the plan's URL out of the destination's logs,
                                // which for a document about a family's child is
                                // the point rather than a formality.
                                rel="noopener noreferrer"
                              >
                                {workshop.title}
                                <span className="workshop-cta">
                                  {copy.openWorkshop}
                                </span>
                              </a>
                            ) : (
                              <p className="workshop-title">{workshop.title}</p>
                            )}
                            <p className="section-para">
                              {workshop.whyThisFamily}
                            </p>
                          </div>
                        ))}
                      </div>
                      {/* Its own class, not `section-placeholder`: that one
                          means "the model has not written this yet", and a note
                          about missing URLs is a different statement that
                          happened to look the same. */}
                      {!anyWorkshopLinked ? (
                        <p className="workshops-note">{copy.workshopsUnlinked}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
