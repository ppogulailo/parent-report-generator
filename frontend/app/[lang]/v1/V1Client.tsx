'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { clearProgress, loadProgress, saveProgress } from './progress-store';

/**
 * The Version 1.0 questionnaire, in the existing design, one concern domain at a
 * time.
 *
 * Every class here already exists in `globals.css` and is what the live
 * questionnaire uses — `brandbar`, `block`, `qgroup-head`, `qcard`, `opts`,
 * `crisis-card`. The copy comes from `i18n.ts` for the same reason: this is the
 * same product with a different engine behind it, and it should not announce
 * that to the parent.
 *
 * Three things differ from the live flow, all deliberate:
 *
 *   · Answers are keyed by question id, not by array position. The live 24-slot
 *     array silently re-maps every answer the moment the questionnaire is
 *     reordered — and reordering is a content edit now.
 *   · The questions come from the backend rather than a second copy in
 *     `app/questions.ts`.
 *   · It is stepped rather than one long scroll, and a parent's place is saved
 *     in this browser so closing the tab does not cost them the work.
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
    version: string;
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

/** The strings the V1 flow adds. Everything else comes from `i18n.ts`. */
const EXTRA = {
  en: {
    draft:
      'This assessment is under review. The methodology is not final, so treat any plan it produces as a draft.',
    optional: 'Optional',
    workshopsUnlinked: 'Links to these workshops are coming soon.',
    openWorkshop: 'Open in ASAP Community',
    resumeHeading: 'You have answers saved',
    resumeBody: (answered: number, total: number) =>
      `You answered ${answered} of ${total} questions last time. Nothing was sent anywhere.`,
    continueLabel: 'Continue',
    startFreshLabel: 'Start fresh',
    next: 'Next',
    back: 'Back',
    stepOf: (current: number, total: number) => `Step ${current} of ${total}`,
    stepIncomplete: 'Answer every question in this section to continue.',
    lastStepTitle: 'Before your plan',
    lastStepDesc:
      'Two optional questions, then your plan. Neither one changes your priorities.',
    moreTitle: 'One more question',
    moreDesc: 'This one does not belong to any of the areas above.',
  },
  es: {
    draft:
      'Esta evaluación está en revisión. La metodología no es definitiva, así que trata cualquier plan que produzca como un borrador.',
    optional: 'Opcional',
    workshopsUnlinked:
      'Los enlaces a estos workshops estarán disponibles pronto.',
    openWorkshop: 'Abrir en ASAP Community',
    resumeHeading: 'Tienes respuestas guardadas',
    resumeBody: (answered: number, total: number) =>
      `La última vez respondiste ${answered} de ${total} preguntas. No se envió nada a ningún lugar.`,
    continueLabel: 'Continuar',
    startFreshLabel: 'Empezar de cero',
    next: 'Siguiente',
    back: 'Atrás',
    stepOf: (current: number, total: number) => `Paso ${current} de ${total}`,
    stepIncomplete: 'Responde todas las preguntas de esta sección para seguir.',
    lastStepTitle: 'Antes de tu plan',
    lastStepDesc:
      'Dos preguntas opcionales, y luego tu plan. Ninguna cambia tus prioridades.',
    moreTitle: 'Una pregunta más',
    moreDesc: 'Esta no pertenece a ninguna de las áreas anteriores.',
  },
} as const;

type Step =
  | {
      kind: 'questions';
      key: string;
      title: string;
      description: string;
      items: { question: Question; number: number }[];
    }
  | { kind: 'final'; key: 'final' };

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
  const [stepIndex, setStepIndex] = useState(0);
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
  const [saved, setSaved] = useState<{
    responses: Record<string, number>;
    gates: Record<string, string>;
    answered: number;
  } | null>(null);

  const stepRoot = useRef<HTMLDivElement | null>(null);

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

  /**
   * Steps: one per concern domain, then whatever no domain claims, then the
   * optional questions.
   *
   * A question can belong to two domains — the approved methodology overlaps, so
   * q18 and q22 each count toward two — and it is shown in the first domain that
   * claims it. Showing it twice would make a 24-question assessment look like 26
   * and give a parent two cards holding one answer.
   */
  const steps = useMemo<Step[]>(() => {
    const seen = new Set<string>();
    let number = 0;

    const domainSteps = [...questionnaire.domains]
      .sort((a, b) => a.order - b.order)
      .map((domain) => {
        const items = domain.questionIds
          .filter((id) => !seen.has(id) && byId.has(id))
          .map((id) => {
            seen.add(id);
            number += 1;
            return { question: byId.get(id)!, number };
          });
        return {
          kind: 'questions' as const,
          key: domain.id,
          title: domain.label[language],
          description: domain.description[language],
          items,
        };
      })
      .filter((candidate) => candidate.items.length > 0);

    // q04 belongs to no domain today. It is still asked, so it still needs a
    // step — numbered after the grouped ones, because a badge repeating a number
    // already used is worse than a gap in the sequence.
    const orphans = questionnaire.questions
      .filter((q) => !seen.has(q.id))
      .sort((a, b) => a.order - b.order)
      .map((question) => {
        number += 1;
        return { question, number };
      });

    return [
      ...domainSteps,
      ...(orphans.length > 0
        ? [
            {
              kind: 'questions' as const,
              key: 'other',
              title: extra.moreTitle,
              description: extra.moreDesc,
              items: orphans,
            },
          ]
        : []),
      { kind: 'final' as const, key: 'final' },
    ];
  }, [questionnaire.domains, questionnaire.questions, byId, language, extra]);

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
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  const stepAnswered =
    step.kind === 'questions'
      ? step.items.filter((item) => responses[item.question.id] !== undefined)
          .length
      : 0;
  const stepComplete =
    step.kind === 'final' || stepAnswered === step.items.length;

  /** The first step still missing an answer, so Continue lands where the parent
   *  left off rather than back at the beginning. */
  const firstIncompleteStep = (answers: Record<string, number>): number => {
    const index = steps.findIndex(
      (candidate) =>
        candidate.kind === 'questions' &&
        candidate.items.some((item) => answers[item.question.id] === undefined),
    );
    return index === -1 ? steps.length - 1 : index;
  };

  // Offer to resume, once, on first load.
  useEffect(() => {
    const found = loadProgress(questionnaire.questions.map((q) => q.id));
    if (!found) return;
    setSaved({
      responses: found.responses,
      gates: found.gates,
      answered: Object.keys(found.responses).length,
    });
  }, [questionnaire.questions]);

  // Save on every change. Cheap, and the alternative is picking a moment to
  // save, which is always the moment after the tab closed.
  useEffect(() => {
    if (stage === 'done') return;
    saveProgress(responses, gates, questionnaire.version);
  }, [responses, gates, questionnaire.version, stage]);

  function goToStep(next: number) {
    setStepIndex(next);
  }

  /**
   * Put the new step's first question at the top of the screen.
   *
   * In an effect rather than in `goToStep`, because the new step's cards do not
   * exist until React has rendered them — scrolling in the click handler moved
   * to wherever the OLD step's content happened to be, which is why pressing
   * Next used to leave a parent halfway down the previous section.
   *
   * `.qcard` carries `scroll-margin-top: 120px`, so `scrollIntoView` clears the
   * sticky brandbar without this needing to know how tall it is. The step header
   * is the fallback for the final step, which has no question cards.
   */
  useEffect(() => {
    if (stage !== 'form') return;
    const root = stepRoot.current;
    if (!root) return;
    const target =
      root.querySelector('.qcard') ?? root.querySelector('.qgroup-head');
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [stepIndex, stage]);

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
      // The plan exists now, so the saved answers have done their job. Clearing
      // them keeps a record of somebody's child out of a browser that is often
      // on a shared family computer.
      clearProgress();
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

        {stage !== 'done' && saved ? (
          <section className="block" id="resume">
            <div className="crisis-card">
              <h2 className="crisis-heading">{extra.resumeHeading}</h2>
              <p className="crisis-intro">
                {extra.resumeBody(saved.answered, total)}
              </p>
              <div className="stepnav">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setResponses(saved.responses);
                    setGates(saved.gates);
                    setSaved(null);
                    goToStep(firstIncompleteStep(saved.responses));
                  }}
                >
                  <span>{extra.continueLabel}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    clearProgress();
                    setSaved(null);
                    setResponses({});
                    setGates({});
                    goToStep(0);
                  }}
                >
                  <span>{extra.startFreshLabel}</span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {stage !== 'done' && !saved ? (
          <section className="block" id="questionnaire" ref={stepRoot}>
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
                <span className="step-count">
                  {extra.stepOf(stepIndex + 1, steps.length)}
                </span>
              </div>
              <div className="progress-track" aria-hidden>
                <div
                  className="progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {step.kind === 'questions' ? (
              <div className="qgroups">
                <div>
                  <div className="qgroup-head">
                    <span className="qgroup-badge">{stepIndex + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 className="qgroup-title">{step.title}</h3>
                      <p className="qgroup-desc">{step.description}</p>
                    </div>
                    <span
                      className="qgroup-count"
                      style={{
                        color: stepComplete
                          ? 'var(--positive)'
                          : 'var(--grey-500)',
                      }}
                    >
                      {stepAnswered}/{step.items.length}
                    </span>
                  </div>
                  <div className="qgroup-questions">
                    {step.items.map((item) =>
                      questionCard(item.question, item.number),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="qgroup-head">
                  <span className="qgroup-badge">{stepIndex + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="qgroup-title">{extra.lastStepTitle}</h3>
                    <p className="qgroup-desc">{extra.lastStepDesc}</p>
                  </div>
                </div>

                {/* A question, so it looks like one. It was a grey note card,
                    which read as an aside next to the urgent field rather than
                    as something to answer — and with no 1–4 chip the options
                    were bare text with nothing to aim at. */}
                {questionnaire.gates.map((gate) => {
                  const chosen = gates[gate.id];
                  return (
                    <div
                      className={`qcard${chosen ? ' answered' : ''}`}
                      key={gate.id}
                    >
                      {/* No number badge: this question is outside the scored
                          twenty-four, and borrowing their numbering would imply
                          it counts toward the plan. It does not. */}
                      <div className="qcard-head">
                        <div style={{ minWidth: 0 }}>
                          <p className="qtext">
                            {gate.prompt[language]}{' '}
                            <span className="opt-optional">
                              {extra.optional}
                            </span>
                          </p>
                          {gate.help ? (
                            <p className="qgroup-desc">{gate.help[language]}</p>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="opts"
                        role="radiogroup"
                        aria-label={gate.prompt[language]}
                      >
                        {gate.options.map((option) => {
                          const checked = chosen === option.value;
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
                              {/* Stands in for the 1–4 chip: without something
                                  to aim at, the options read as a list rather
                                  than a set of choices. */}
                              <span
                                className={`opt-radio${checked ? ' checked' : ''}`}
                                aria-hidden
                              />
                              <span className="opt-text">
                                {option.label[language]}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

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
                    placeholder={
                      questionnaire.urgentField.placeholder[language]
                    }
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
              </>
            )}

            <div className="stepnav no-print">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={stepIndex === 0 || loading}
                onClick={() => goToStep(stepIndex - 1)}
              >
                <span>{extra.back}</span>
              </button>

              {step.kind === 'questions' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  // Genuinely disabled, not `aria-disabled`. The first attempt
                  // used aria-disabled so the button stayed pressable and could
                  // explain itself — but aria-disabled tells assistive
                  // technology the control IS disabled, so a screen-reader user
                  // got the dead end anyway. The reason is shown below instead,
                  // permanently, so nobody has to press it to find out.
                  disabled={!stepComplete || loading}
                  onClick={() => goToStep(stepIndex + 1)}
                >
                  <span>{extra.next}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!allAnswered || loading}
                  onClick={() => void submit()}
                  aria-busy={loading}
                >
                  {loading ? <Spinner /> : null}
                  <span>{loading ? t.writing : t.generate}</span>
                </button>
              )}
            </div>

            {step.kind === 'questions' && !stepComplete ? (
              <p className="generate-hint">
                <span>{extra.stepIncomplete}</span>
              </p>
            ) : null}

            {step.kind === 'final' && !allAnswered ? (
              <p className="generate-hint">
                <span>{t.submitHint}</span>
              </p>
            ) : null}

            {loading ? (
              <p className="generate-hint" aria-live="polite">
                <span>{t.writingSub}</span>
              </p>
            ) : null}
          </section>
        ) : null}

        {error ? (
          <div className="error" role="alert">
            <strong>{t.errorHeading}</strong>
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void submit()}
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
                  goToStep(0);
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
