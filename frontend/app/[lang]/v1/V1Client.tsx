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
import {
  clearPlanPointer,
  loadPlanPointer,
  savePlanPointer,
  type SavedPlanPointer,
} from './plan-store';
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
  /** Whether the API can hand back a PDF (capabilities.pdf). */
  pdfAvailable: boolean;
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
      'One optional question, then your plan. It does not change your priorities.',
    moreTitle: 'One more question',
    moreDesc: 'This one does not belong to any of the areas above.',
    planLinkHeading: 'Your private link',
    planLinkNote:
      'This plan is saved at the link below for 90 days — on this device or any other. After that it is deleted automatically, so download the PDF or print a copy to keep it.',
    copyLink: 'Copy link',
    copied: 'Copied ✓',
    pdfButton: 'Download PDF',
    deleteButton: 'Delete my data',
    deleteConfirm:
      'Delete your plan, your answers, and everything else we hold about this assessment? This cannot be undone.',
    deletedNote:
      'Everything has been deleted. Nothing about your family remains.',
    savedPlanHeading: 'Your plan is still here',
    savedPlanBody:
      'You finished the assessment, and your plan is saved and ready to read again.',
    savedPlanView: 'Read my plan',
    savedPlanNew: 'Start a new assessment',
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
      'Una pregunta opcional, y luego tu plan. No cambia tus prioridades.',
    moreTitle: 'Una pregunta más',
    moreDesc: 'Esta no pertenece a ninguna de las áreas anteriores.',
    planLinkHeading: 'Tu enlace privado',
    planLinkNote:
      'Este plan queda guardado en el enlace de abajo durante 90 días — en este dispositivo o en cualquier otro. Después se elimina automáticamente, así que descarga el PDF o imprime una copia para conservarlo.',
    copyLink: 'Copiar enlace',
    copied: 'Copiado ✓',
    pdfButton: 'Descargar PDF',
    deleteButton: 'Eliminar mis datos',
    deleteConfirm:
      '¿Eliminar tu plan, tus respuestas y todo lo demás que guardamos sobre esta evaluación? Esto no se puede deshacer.',
    deletedNote:
      'Todo ha sido eliminado. No queda nada sobre tu familia.',
    savedPlanHeading: 'Tu plan sigue aquí',
    savedPlanBody:
      'Terminaste la evaluación, y tu plan está guardado y listo para leerse de nuevo.',
    savedPlanView: 'Leer mi plan',
    savedPlanNew: 'Empezar una nueva evaluación',
  },
} as const;

/** The first stream event: everything the matrix decided. */
interface StreamDecided {
  /** The saved plan's id — the private return link. Null when persistence was
   *  unavailable and the plan is being served unsaved. */
  planId: string | null;
  tierId: string;
  tierLabel: string;
  tierDescription: string;
  domainScores: Record<string, number>;
  topDomains: string[];
  outline: {
    key: string;
    order: number;
    type: ReportSection['type'];
    title: string;
    text?: string;
  }[];
  recommendations: { recommendationId: string; title: string }[];
  workshops: {
    workshopId: string;
    title: string;
    category: string;
    url: string | null;
  }[];
}

/** The plan's shape before any of it is written. Static sections arrive whole —
 *  that copy is the platform's and needs no model. */
function skeletonFrom(meta: StreamDecided): ReportSection[] {
  return meta.outline.map((section) => ({
    key: section.key,
    order: section.order,
    type: section.type,
    title: section.title,
    ...(section.type === 'static' ? { body: section.text ?? '' } : {}),
    // The workshops are the matrix's choice and their titles and links are the
    // platform's, so they are shown at once with only the "why this family"
    // line waiting on the model. Making a parent wait for a list we already
    // hold would be withholding it for no reason.
    ...(section.type === 'workshopList'
      ? { workshops: meta.workshops.map((w) => ({ ...w, whyThisFamily: '' })) }
      : {}),
  }));
}

/**
 * Folds what the model has written so far into the skeleton.
 *
 * Ids come from the matrix, never from the stream: a half-written array can hold
 * a truncated id, and the titles and links a parent sees must not depend on the
 * model getting them right mid-sentence.
 */
function merge(
  outline: ReportSection[],
  written: Record<string, unknown>,
  meta: StreamDecided,
): ReportSection[] {
  return outline.map((section) => {
    const value = written[section.key];
    if (value === undefined) return section;

    if (section.type === 'prose') {
      return typeof value === 'string' ? { ...section, body: value } : section;
    }
    if (section.type === 'list') {
      return Array.isArray(value)
        ? { ...section, items: value.filter((i): i is string => typeof i === 'string') }
        : section;
    }
    if (section.type === 'recommendationList' && Array.isArray(value)) {
      const items = value as {
        recommendationId?: string;
        headline?: string;
        body?: string;
      }[];
      return {
        ...section,
        recommendations: meta.recommendations
          .map((known) => {
            const match = items.find(
              (item) => item.recommendationId === known.recommendationId,
            );
            if (!match?.headline) return null;
            return {
              recommendationId: known.recommendationId,
              title: known.title,
              headline: match.headline,
              body: match.body ?? '',
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null),
      };
    }
    if (section.type === 'workshopList' && Array.isArray(value)) {
      const items = value as { workshopId?: string; whyThisFamily?: string }[];
      return {
        ...section,
        workshops: meta.workshops.map((known) => ({
          ...known,
          whyThisFamily:
            items.find((item) => item.workshopId === known.workshopId)
              ?.whyThisFamily ?? '',
        })),
      };
    }
    return section;
  });
}

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
  pdfAvailable,
  questionnaire,
}: Props) {
  const t = STRINGS[language];
  const extra = EXTRA[language];

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [gates, setGates] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [stage, setStage] = useState<'form' | 'working' | 'done'>('form');
  const [writing, setWriting] = useState(false);
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
  /** The saved plan's id, once persistence has one. Null when the plan could
   *  not be saved — the plan itself still renders, just without a link. */
  const [planId, setPlanId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [savedPlan, setSavedPlan] = useState<SavedPlanPointer | null>(null);

  useEffect(() => {
    setSavedPlan(loadPlanPointer());
  }, []);

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

    // A question no domain claims still needs a step — numbered after the
    // grouped ones, because a badge repeating a number already used is worse
    // than a gap in the sequence. Since the 2026-08-25 approval put q04 into
    // Immediate Safety & Urgency there is no such question, but the content
    // decides that, not this component.
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
      // Only gates the current questionnaire still asks. A gate can be removed
      // by a content edit — treatment-status was, on 2026-08-25 — and quietly
      // restoring a stale answer would make the submit fail validation.
      gates: Object.fromEntries(
        Object.entries(found.gates).filter(([id]) =>
          questionnaire.gates.some((gate) => gate.id === id),
        ),
      ),
      answered: Object.keys(found.responses).length,
    });
  }, [questionnaire.questions, questionnaire.gates]);

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

  /**
   * Opens the stream and moves to the results screen at once.
   *
   * The matrix's decision — scores, severity, the workshops with their links,
   * the platform's own copy — needs no model, so it arrives in the first event
   * and the parent sees their results immediately. The written sections fill in
   * behind it. Waiting a minute on the form for all of it was the worst part of
   * this flow.
   */
  async function submit() {
    setStage('working');
    setWriting(true);
    setError(null);
    setSections([]);

    try {
      const response = await fetch('/api/assessment/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          language,
          gates,
          urgentConcern: urgent.trim() || undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? t.errorHeading);
        setStage('form');
        setWriting(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let outline: ReportSection[] = [];
      let meta: StreamDecided | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Events are separated by a blank line; a partial one stays buffered.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const event = frame
            .split('\n')
            .find((line) => line.startsWith('event:'))
            ?.slice(6)
            .trim();
          const dataLine = frame
            .split('\n')
            .find((line) => line.startsWith('data:'));
          if (!event || !dataLine) continue;

          let payload: unknown;
          try {
            payload = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }

          if (event === 'decided') {
            meta = payload as StreamDecided;
            outline = skeletonFrom(meta);
            if (meta.planId) {
              setPlanId(meta.planId);
              savePlanPointer({
                planId: meta.planId,
                language,
                savedAt: Date.now(),
              });
            }
            setSeverity({
              tierId: meta.tierId,
              label: meta.tierLabel,
              description: meta.tierDescription,
            });
            setDomainScores(meta.domainScores);
            setTopDomains(meta.topDomains);
            setSections(outline);
            // Straight to the results screen, before a word has been written.
            setStage('done');
            clearProgress();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }

          if (event === 'partial' && meta) {
            const written = (payload as { sections: Record<string, unknown> })
              .sections;
            setSections(merge(outline, written, meta));
          }

          if (event === 'revising' && meta) {
            // The attempt broke a rule and is being rewritten from scratch, so
            // what is on screen is not what the parent will keep.
            setSections(outline);
          }

          if (event === 'report') {
            const body = payload as {
              report: { sections: ReportSection[] };
              severity?: ReportSeverity;
            };
            setSections(body.report.sections);
            if (body.severity) setSeverity(body.severity);
            setWriting(false);
          }

          if (event === 'failed') {
            setError(
              (payload as { error?: string }).error ?? t.errorHeading,
            );
            setStage('form');
            setWriting(false);
            return;
          }
        }
      }
    } catch {
      setError(t.errorHeading);
      setStage('form');
    } finally {
      setWriting(false);
    }
  }

  /** Back plus either Next or the generate button. Rendered twice — above and
   *  below the section — from one definition, so they cannot drift apart. */
  const stepNav = () => (
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
          // Genuinely disabled, not `aria-disabled`. The first attempt used
          // aria-disabled so the button stayed pressable and could explain
          // itself — but aria-disabled tells assistive technology the control IS
          // disabled, so a screen-reader user got the dead end anyway. The
          // reason is shown below instead, permanently.
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
  );

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

        {stage === 'form' && savedPlan && !saved ? (
          /* A finished plan outranks half-finished answers: the parent who
             comes back has a plan waiting, and re-answering from scratch is
             the fallback, not the greeting. */
          <section className="block" id="saved-plan">
            <div className="crisis-card">
              <h2 className="crisis-heading">{extra.savedPlanHeading}</h2>
              <p className="crisis-intro">{extra.savedPlanBody}</p>
              <div className="stepnav">
                <Link
                  className="btn btn-primary"
                  href={`/${language}/plan/${savedPlan.planId}`}
                >
                  <span>{extra.savedPlanView}</span>
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSavedPlan(null)}
                >
                  <span>{extra.savedPlanNew}</span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

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

            {/* Pagination above the questions as well as below it. On a long
                section the controls were only reachable by scrolling to the
                bottom, which meant scrolling back up to read the heading. */}
            {stepNav()}

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

            {stepNav()}

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
              writing={writing}
              copy={{
                writingPlaceholder: t.writingPlaceholder,
                writingHeading: t.writingTitle,
                writingSub: t.writingSub,
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
            {!writing && planId ? (
              /* The private return link (Milestone 5). Shown only once the
                 plan is actually saved — a link we could not create is not
                 offered, not offered broken. */
              <section className="crisis-card no-print" style={{ marginTop: '1rem' }}>
                <h2 className="crisis-heading">{extra.planLinkHeading}</h2>
                <p className="crisis-intro">{extra.planLinkNote}</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <code
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border, #d5d9e0)',
                      borderRadius: 8,
                      fontSize: '0.85rem',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {`${window.location.origin}/${language}/plan/${planId}`}
                  </code>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(
                          `${window.location.origin}/${language}/plan/${planId}`,
                        )
                        .then(() => {
                          setLinkCopied(true);
                          window.setTimeout(() => setLinkCopied(false), 2000);
                        })
                        .catch(() => {
                          /* the link is visible to copy by hand */
                        });
                    }}
                  >
                    <span>{linkCopied ? extra.copied : extra.copyLink}</span>
                  </button>
                </div>
              </section>
            ) : null}
            {!writing ? (
              <div className="done-actions no-print">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <span>{t.printButton}</span>
              </button>
              {planId && pdfAvailable ? (
                <a
                  className="btn btn-secondary"
                  href={`/api/plan/${planId}/pdf`}
                >
                  <span>{extra.pdfButton}</span>
                </a>
              ) : null}
              {planId ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!window.confirm(extra.deleteConfirm)) return;
                    void fetch(`/api/plan/${planId}`, { method: 'DELETE' })
                      .then((res) => {
                        if (!res.ok) return;
                        clearPlanPointer();
                        setSavedPlan(null);
                        setPlanId(null);
                        setStage('form');
                        setSections([]);
                        setSeverity(null);
                        setDomainScores(null);
                        setTopDomains([]);
                        goToStep(0);
                        window.alert(extra.deletedNote);
                      })
                      .catch(() => {
                        /* the plan page offers the same action with retry */
                      });
                  }}
                >
                  <span>{extra.deleteButton}</span>
                </button>
              ) : null}
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
            ) : null}
            <p className="qgroup-desc no-print" style={{ textAlign: 'center' }}>
              {methodologyVersion}
            </p>
          </>
        ) : null}
      </main>
    </>
  );
}
