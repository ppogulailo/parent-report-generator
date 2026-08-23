'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { STRINGS, type Language } from '../../i18n';
import ReportView, {
  type ReportSection,
  type ReportSeverity,
} from '../ReportView';
import {
  BrandMark,
  CheckIcon,
  MoonIcon,
  SEV_COLORS,
  Spinner,
  SunIcon,
} from '../ui';

/**
 * The Version 1.0 questionnaire, in the existing design.
 *
 * Every class here already exists in `globals.css` and is what the live
 * questionnaire uses — `brandbar`, `block`, `qgroups`, `qcard`, `opts`,
 * `crisis-card`. The copy comes from `i18n.ts` for the same reason: this is the
 * same product with a different engine behind it, and it should not announce
 * that to the parent.
 *
 * Two things differ from the live flow, both deliberate. Answers are held keyed
 * by question id rather than by array position, because the live 24-slot array
 * silently re-maps every answer the moment the questionnaire is reordered — and
 * reordering is a content edit now. And the questions themselves are fetched
 * from the backend rather than duplicated in `app/questions.ts`.
 */

interface Localized {
  en: string;
  es: string;
}

interface Question {
  id: string;
  order: number;
  prompt: Localized;
  options: { value: number; label: Localized }[];
}

interface Domain {
  id: string;
  order: number;
  label: Localized;
  description: Localized;
  questionIds: string[];
}

interface Gate {
  id: string;
  order: number;
  prompt: Localized;
  help?: Localized;
  options: { value: string; label: Localized }[];
}

interface Props {
  language: Language;
  draft: boolean;
  methodologyVersion: string;
  questionnaire: {
    title: Localized;
    intro: Localized;
    domains: Domain[];
    questions: Question[];
    gates: Gate[];
    urgentField: {
      maxLength: number;
      label: Localized;
      help: Localized;
      placeholder: Localized;
    };
  };
}

/** The handful of strings the V1 flow adds. Everything else comes from i18n. */
const EXTRA = {
  en: {
    draft:
      'This assessment is under review. The methodology is not final, so treat any plan it produces as a draft.',
    optional: 'Optional',
    workshopsUnlinked: 'Links to these workshops are coming soon.',
    openWorkshop: 'Open in ASAP Community',
    unanswered: (n: number) =>
      `${n} question${n === 1 ? '' : 's'} still to answer.`,
  },
  es: {
    draft:
      'Esta evaluación está en revisión. La metodología no es definitiva, así que trata cualquier plan que produzca como un borrador.',
    optional: 'Opcional',
    workshopsUnlinked:
      'Los enlaces a estos workshops estarán disponibles pronto.',
    openWorkshop: 'Abrir en ASAP Community',
    unanswered: (n: number) =>
      `Falta${n === 1 ? '' : 'n'} ${n} pregunta${n === 1 ? '' : 's'} por responder.`,
  },
} as const;

export default function V1Client({
  language,
  draft,
  methodologyVersion,
  questionnaire,
}: Props) {
  const t = STRINGS[language];
  const extra = EXTRA[language];

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [gates, setGates] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState('');
  const [stage, setStage] = useState<'form' | 'working' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [severity, setSeverity] = useState<ReportSeverity | null>(null);
  const [domainScores, setDomainScores] = useState<Record<
    string,
    number
  > | null>(null);
  const [topDomains, setTopDomains] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('apap-theme');
    if (stored === 'dark' || stored === 'light') setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('apap-theme', theme);
  }, [theme]);

  const byId = useMemo(
    () => new Map(questionnaire.questions.map((q) => [q.id, q])),
    [questionnaire.questions],
  );

  /** Questions grouped by domain, numbered in questionnaire order.
   *
   *  A question can belong to two domains — the approved methodology overlaps —
   *  so it is shown in the first domain that claims it, and the running number
   *  stays unique. Showing it twice would make a 24-question assessment look
   *  like 26. */
  const groups = useMemo(() => {
    const seen = new Set<string>();
    let number = 0;
    return [...questionnaire.domains]
      .sort((a, b) => a.order - b.order)
      .map((domain) => {
        const items = domain.questionIds
          .filter((id) => !seen.has(id) && byId.has(id))
          .map((id) => {
            seen.add(id);
            number += 1;
            return { question: byId.get(id)!, number };
          });
        return { domain, items };
      })
      .filter((group) => group.items.length > 0);
  }, [questionnaire.domains, byId]);

  /**
   * Any question no domain claims — q04 today — still has to be answerable, and
   * numbered continuing from the grouped ones.
   *
   * Using the question's own `order` here collided: the grouped questions are
   * numbered 1..23 by position, so q04's order of 4 produced two cards labelled
   * 4. A parent counting through the form would have seen 24 questions with a
   * repeated number and no 24th.
   */
  const ungrouped = useMemo(() => {
    const claimed = new Set(
      questionnaire.domains.flatMap((d) => d.questionIds),
    );
    const grouped = questionnaire.questions.filter((q) =>
      claimed.has(q.id),
    ).length;
    return questionnaire.questions
      .filter((q) => !claimed.has(q.id))
      .sort((a, b) => a.order - b.order)
      .map((question, index) => ({ question, number: grouped + index + 1 }));
  }, [questionnaire.domains, questionnaire.questions]);

  /** Domain descriptions keyed by the label the API returns scores under, so the
   *  report can explain an area when a parent opens it. */
  const domainDescriptions = useMemo(
    () =>
      Object.fromEntries(
        questionnaire.domains.map((d) => [
          d.label[language],
          d.description[language],
        ]),
      ),
    [questionnaire.domains, language],
  );

  const total = questionnaire.questions.length;
  const answeredCount = Object.keys(responses).length;
  const allAnswered = answeredCount === total;
  const progressPct = total > 0 ? (answeredCount / total) * 100 : 0;
  const loading = stage === 'working';

  async function submit() {
    setStage('working');
    setError(null);
    try {
      const response = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          language,
          gates,
          urgentConcern: urgent.trim() || undefined,
        }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        severity?: ReportSeverity;
        domainScores?: Record<string, number>;
        topDomains?: string[];
        report?: { sections: ReportSection[] };
      };

      if (!response.ok || !body.success || !body.report) {
        setError(body.error ?? t.errorHeading);
        setStage('form');
        return;
      }

      setSections(body.report.sections);
      setSeverity(body.severity ?? null);
      setDomainScores(body.domainScores ?? null);
      setTopDomains(body.topDomains ?? []);
      setStage('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(t.errorHeading);
      setStage('form');
    }
  }

  const questionCard = (question: Question, number: number) => {
    const selected = responses[question.id];
    const answered = selected !== undefined;
    return (
      <div
        className={`qcard${answered ? ' answered' : ''}`}
        key={question.id}
        id={`q-${question.id}`}
      >
        <div className="qcard-head">
          <span className="qbadge">
            {number}
            {answered ? (
              <span className="qbadge-check" aria-hidden>
                <CheckIcon size={7} stroke="white" />
              </span>
            ) : null}
          </span>
          <p className="qtext">{question.prompt[language]}</p>
        </div>
        <div
          className="opts"
          role="radiogroup"
          aria-label={question.prompt[language]}
        >
          {question.options.map((option) => {
            const checked = selected === option.value;
            const colour = SEV_COLORS[option.value - 1];
            return (
              <label
                key={option.value}
                className="opt"
                style={
                  checked
                    ? {
                        borderColor: colour,
                        background: `color-mix(in srgb, ${colour} 12%, var(--surface))`,
                      }
                    : undefined
                }
              >
                <input
                  type="radio"
                  className="visually-hidden"
                  name={question.id}
                  value={option.value}
                  checked={checked}
                  onChange={() =>
                    setResponses((previous) => ({
                      ...previous,
                      [question.id]: option.value,
                    }))
                  }
                  aria-label={`${option.value} — ${option.label[language]}`}
                />
                <span
                  className="opt-chip"
                  style={{
                    borderColor: checked
                      ? colour
                      : `color-mix(in srgb, ${colour} 45%, var(--border))`,
                    background: checked ? colour : 'transparent',
                    color: checked ? '#fff' : colour,
                  }}
                >
                  {option.value}
                </span>
                <span className="opt-text">{option.label[language]}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="brandbar no-print">
        <div className="brandbar-inner">
          <div className="brand">
            <BrandMark />
            <span>ASAP Community</span>
          </div>
          <div className="brandbar-controls">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
              aria-label={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <nav
              className="langswitch"
              aria-label={t.languageLabel}
              role="radiogroup"
            >
              {(['en', 'es'] as Language[]).map((code) => (
                <Link
                  key={code}
                  href={`/${code}/v1`}
                  role="radio"
                  aria-checked={language === code}
                  aria-disabled={loading}
                  tabIndex={loading ? -1 : 0}
                  className={`lang-label${language === code ? ' active' : ''}${
                    loading ? ' disabled' : ''
                  }`}
                  prefetch={false}
                  onClick={(event) => {
                    if (loading) event.preventDefault();
                  }}
                >
                  <span>{code.toUpperCase()}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="block">
          <h2 className="block-heading">{questionnaire.title[language]}</h2>
          <p className="block-sub">{questionnaire.intro[language]}</p>
          {draft ? (
            <p className="safety-note" role="note">
              {extra.draft}
            </p>
          ) : null}
        </section>

        {stage !== 'done' ? (
          <>
            <section className="block" id="questionnaire">
              <h2 className="block-heading">{t.questionnaireHeading}</h2>
              <p className="block-sub">{t.questionnaireSub}</p>

              <div className="scale-legend">
                <span>{t.severityLegend}</span>
                <span className="scale-swatches" aria-hidden>
                  {SEV_COLORS.map((colour) => (
                    <span
                      key={colour}
                      className="scale-swatch"
                      style={{ background: colour }}
                    />
                  ))}
                </span>
                <span>{t.severityLegendHigh}</span>
              </div>

              <div className="progress no-print">
                <div className="progress-row">
                  <span className="progress-label">
                    <span>{t.answeredOf(answeredCount)}</span>
                  </span>
                </div>
                <div className="progress-track" aria-hidden>
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <div className="qgroups">
                {groups.map((group, index) => {
                  const answered = group.items.filter(
                    (item) => responses[item.question.id] !== undefined,
                  ).length;
                  return (
                    <div key={group.domain.id}>
                      <div className="qgroup-head">
                        <span className="qgroup-badge">{index + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="qgroup-title">
                            {group.domain.label[language]}
                          </h3>
                          <p className="qgroup-desc">
                            {group.domain.description[language]}
                          </p>
                        </div>
                        <span
                          className="qgroup-count"
                          style={{
                            color:
                              answered === group.items.length
                                ? 'var(--positive)'
                                : 'var(--grey-500)',
                          }}
                        >
                          {answered}/{group.items.length}
                        </span>
                      </div>
                      <div className="qgroup-questions">
                        {group.items.map((item) =>
                          questionCard(item.question, item.number),
                        )}
                      </div>
                    </div>
                  );
                })}

                {ungrouped.length > 0 ? (
                  <div className="qgroup-questions">
                    {ungrouped.map((item) =>
                      questionCard(item.question, item.number),
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {questionnaire.gates.map((gate) => (
              <section className="block" key={gate.id}>
                <div className="crisis-card">
                  <h2 className="crisis-heading">
                    {gate.prompt[language]}{' '}
                    <span className="qgroup-desc">({extra.optional})</span>
                  </h2>
                  {gate.help ? (
                    <p className="crisis-intro">{gate.help[language]}</p>
                  ) : null}
                  <div
                    className="opts"
                    role="radiogroup"
                    aria-label={gate.prompt[language]}
                  >
                    {gate.options.map((option) => {
                      const checked = gates[gate.id] === option.value;
                      return (
                        <label
                          key={option.value}
                          className="opt"
                          style={
                            checked
                              ? {
                                  borderColor: 'var(--accent-violet)',
                                  background:
                                    'color-mix(in srgb, var(--accent-violet) 10%, var(--surface))',
                                }
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            className="visually-hidden"
                            name={gate.id}
                            value={option.value}
                            checked={checked}
                            onChange={() =>
                              setGates((previous) => ({
                                ...previous,
                                [gate.id]: option.value,
                              }))
                            }
                            aria-label={option.label[language]}
                          />
                          <span className="opt-text">
                            {option.label[language]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}

            <section className="block">
              <div className="crisis-card">
                <h2 className="crisis-heading">{t.crisisHeading}</h2>
                <p className="crisis-intro">{t.crisisIntro}</p>
                <label className="crisis-fieldlabel" htmlFor="urgent">
                  {questionnaire.urgentField.label[language]}{' '}
                  <span className="qgroup-desc">({extra.optional})</span>
                </label>
                <textarea
                  id="urgent"
                  className="crisis-textarea"
                  maxLength={questionnaire.urgentField.maxLength}
                  placeholder={questionnaire.urgentField.placeholder[language]}
                  value={urgent}
                  onChange={(event) => setUrgent(event.target.value)}
                />
                <p className="crisis-count">
                  {t.crisisHint(
                    questionnaire.urgentField.maxLength - urgent.length,
                  )}
                </p>
                <p className="safety-note">{t.crisisSafetyNotice}</p>
              </div>
            </section>

            <section className="block no-print">
              <button
                type="button"
                className="btn btn-primary btn-full"
                disabled={!allAnswered || loading}
                onClick={submit}
                aria-busy={loading}
              >
                {loading ? <Spinner /> : null}
                <span>{loading ? t.writing : t.generate}</span>
              </button>
              {!allAnswered ? (
                <p className="generate-hint">
                  <span>{extra.unanswered(total - answeredCount)}</span>
                </p>
              ) : null}
              {loading ? (
                <p className="generate-hint" aria-live="polite">
                  <span>{t.writingSub}</span>
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        {error ? (
          <div className="error" role="alert">
            <strong>{t.errorHeading}</strong>
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={submit}
            >
              <span>{t.retry}</span>
            </button>
          </div>
        ) : null}

        {stage === 'done' ? (
          <>
            <ReportView
              sections={sections}
              severity={severity}
              domainScores={domainScores}
              domainDescriptions={domainDescriptions}
              topDomains={topDomains}
              language={language}
              copy={{
                planLevelLabel: t.planLevelLabel,
                domainScoresHeading: t.domainScoresHeading,
                domainScoresHint: t.domainScoresHint,
                topPrioritiesHeading: t.topPrioritiesHeading,
                actionPlanHeading: t.actionPlanHeading,
                readyHeading: t.doneTitle,
                readySub: t.doneSub,
                workshopsUnlinked: extra.workshopsUnlinked,
                openWorkshop: extra.openWorkshop,
              }}
            />
            <div className="done-actions no-print">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <span>{t.printButton}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setStage('form');
                  setSections([]);
                  setSeverity(null);
                  setDomainScores(null);
                  setTopDomains([]);
                  window.scrollTo({ top: 0 });
                }}
              >
                <span>{t.startOverButton}</span>
              </button>
            </div>
            <p className="qgroup-desc no-print" style={{ textAlign: 'center' }}>
              {methodologyVersion}
            </p>
          </>
        ) : null}
      </main>
    </>
  );
}
