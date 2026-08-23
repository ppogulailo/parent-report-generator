'use client';

/**
 * Renders a Version 1.0 plan.
 *
 * The plan arrives as structured sections rather than one block of text, which is
 * what makes two things possible that the streaming view cannot do: a workshop
 * can carry a link, and a section that the model failed to write is visibly
 * absent rather than silently empty.
 *
 * Section types map to shapes, not to hard-coded keys — adding a section in
 * `content/report-templates/sections.json` renders here without a frontend
 * change, which is the point of keeping the report structure in content.
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
  language: 'en' | 'es';
}

const COPY = {
  en: {
    severity: 'Where this plan sits',
    workshopsUnlinked: 'Links to these workshops are coming soon.',
    openWorkshop: 'Open in ASAP Community',
  },
  es: {
    severity: 'Dónde se ubica este plan',
    workshopsUnlinked: 'Los enlaces a estos workshops estarán disponibles pronto.',
    openWorkshop: 'Abrir en ASAP Community',
  },
} as const;

/** Paragraph breaks are the only formatting the model is asked for, so the body
 *  is split rather than parsed. Nothing here interprets markdown: a stray
 *  asterisk in a parent's plan should read as an asterisk. */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} className="rv-p">
            {paragraph}
          </p>
        ))}
    </>
  );
}

export default function ReportView({ sections, severity, language }: Props) {
  const copy = COPY[language];
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const anyWorkshopLinked = ordered.some((section) =>
    section.workshops?.some((workshop) => workshop.url !== null),
  );

  return (
    <div className="rv">
      {severity ? (
        <div className="rv-severity">
          <span className="rv-severity-label">{copy.severity}</span>
          <strong className="rv-severity-tier">{severity.label}</strong>
          <p className="rv-severity-desc">{severity.description}</p>
        </div>
      ) : null}

      {ordered.map((section) => (
        <section key={section.key} className="rv-section">
          <h2 className="rv-h2">{section.title}</h2>

          {(section.type === 'prose' || section.type === 'static') &&
          section.body ? (
            <Paragraphs text={section.body} />
          ) : null}

          {section.type === 'list' && section.items ? (
            <ul className="rv-list">
              {section.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}

          {section.type === 'recommendationList' && section.recommendations ? (
            <div className="rv-recs">
              {section.recommendations.map((rec) => (
                <article key={rec.recommendationId} className="rv-rec">
                  <h3 className="rv-h3">{rec.headline}</h3>
                  {/* The area's own name, from the matrix — so a parent can see
                      the methodology's framing alongside the model's headline. */}
                  <span className="rv-rec-area">{rec.title}</span>
                  <Paragraphs text={rec.body} />
                </article>
              ))}
            </div>
          ) : null}

          {section.type === 'workshopList' && section.workshops ? (
            <>
              <ul className="rv-workshops">
                {section.workshops.map((workshop) => (
                  <li key={workshop.workshopId} className="rv-workshop">
                    <span className="rv-workshop-cat">{workshop.category}</span>
                    {workshop.url ? (
                      <a
                        className="rv-workshop-title rv-link"
                        href={workshop.url}
                        target="_blank"
                        // noopener is the security half; noreferrer keeps the
                        // plan's URL out of the destination's logs, which for a
                        // document about a family's child is the point.
                        rel="noopener noreferrer"
                      >
                        {workshop.title}
                        <span className="rv-workshop-cta">
                          {copy.openWorkshop}
                        </span>
                      </a>
                    ) : (
                      <span className="rv-workshop-title">
                        {workshop.title}
                      </span>
                    )}
                    <p className="rv-p rv-workshop-why">
                      {workshop.whyThisFamily}
                    </p>
                  </li>
                ))}
              </ul>
              {!anyWorkshopLinked ? (
                <p className="rv-note">{copy.workshopsUnlinked}</p>
              ) : null}
            </>
          ) : null}
        </section>
      ))}

    </div>
  );
}
