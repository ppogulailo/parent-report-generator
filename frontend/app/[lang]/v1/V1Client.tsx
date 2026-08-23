'use client';

import { useMemo, useState } from 'react';
import ReportView, {
  type ReportSection,
  type ReportSeverity,
} from '../ReportView';

/**
 * The Version 1.0 questionnaire flow.
 *
 * Answers are held keyed by question id rather than by position. The live
 * questionnaire uses a 24-slot array, which silently re-maps every answer onto a
 * different question the moment the questionnaire is reordered — and reordering
 * is a content edit now, so that failure mode has to go.
 */

type Language = 'en' | 'es';

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

const COPY = {
  en: {
    submit: 'Build my plan',
    working: 'Writing your plan…',
    workingNote:
      'This takes up to a minute. The plan is written for your answers specifically, not assembled from a template.',
    unanswered: (n: number) =>
      `${n} question${n === 1 ? '' : 's'} still to answer.`,
    draft:
      'This assessment is under review. The methodology is not final, so treat any plan it produces as a draft.',
    optional: 'Optional',
    startOver: 'Start over',
    print: 'Print or save as PDF',
    failed: 'Something went wrong writing your plan. Please try again.',
  },
  es: {
    submit: 'Crear mi plan',
    working: 'Escribiendo tu plan…',
    workingNote:
      'Esto toma hasta un minuto. El plan se escribe para tus respuestas específicamente, no se arma desde una plantilla.',
    unanswered: (n: number) =>
      `Falta${n === 1 ? '' : 'n'} ${n} pregunta${n === 1 ? '' : 's'} por responder.`,
    draft:
      'Esta evaluación está en revisión. La metodología no es definitiva, así que trata cualquier plan que produzca como un borrador.',
    optional: 'Opcional',
    startOver: 'Empezar de nuevo',
    print: 'Imprimir o guardar como PDF',
    failed: 'Algo salió mal al escribir tu plan. Vuelve a intentarlo.',
  },
} as const;

export default function V1Client({
  language,
  draft,
  methodologyVersion,
  questionnaire,
}: Props) {
  const copy = COPY[language];

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [gates, setGates] = useState<Record<string, string>>({});
  const [urgent, setUrgent] = useState('');
  const [stage, setStage] = useState<'form' | 'working' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [severity, setSeverity] = useState<ReportSeverity | null>(null);

  const questions = useMemo(
    () => [...questionnaire.questions].sort((a, b) => a.order - b.order),
    [questionnaire.questions],
  );

  const unanswered = questions.filter(
    (question) => responses[question.id] === undefined,
  ).length;

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
        report?: { sections: ReportSection[] };
      };

      if (!response.ok || !body.success || !body.report) {
        setError(body.error ?? copy.failed);
        setStage('form');
        return;
      }

      setSections(body.report.sections);
      setSeverity(body.severity ?? null);
      setStage('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(copy.failed);
      setStage('form');
    }
  }

  if (stage === 'done') {
    return (
      <main className="v1-main">
        {draft ? <p className="v1-draft">{copy.draft}</p> : null}
        <ReportView
          sections={sections}
          severity={severity}
          language={language}
        />
        <div className="v1-done-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            {copy.print}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setStage('form');
              setSections([]);
              setSeverity(null);
            }}
          >
            {copy.startOver}
          </button>
        </div>
        <p className="v1-version">methodology {methodologyVersion}</p>
      </main>
    );
  }

  return (
    <main className="v1-main">
      <h1 className="v1-title">{questionnaire.title[language]}</h1>
      <p className="v1-intro">{questionnaire.intro[language]}</p>
      {draft ? <p className="v1-draft">{copy.draft}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (unanswered === 0 && stage === 'form') void submit();
        }}
      >
        <ol className="v1-questions">
          {questions.map((question) => (
            <li key={question.id} className="v1-question">
              {/* A fieldset per question, so a screen reader announces the
                  question with each option rather than reading four bare
                  labels. */}
              <fieldset className="v1-fieldset">
                <legend className="v1-legend">
                  {question.prompt[language]}
                </legend>
                <div className="v1-options">
                  {question.options.map((option) => (
                    <label key={option.value} className="v1-option">
                      <input
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={responses[question.id] === option.value}
                        onChange={() =>
                          setResponses((previous) => ({
                            ...previous,
                            [question.id]: option.value,
                          }))
                        }
                      />
                      <span>{option.label[language]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>

        {/* The gates are not scored and cannot change severity. They sit after
            the scored questions so nothing about the layout suggests otherwise. */}
        {questionnaire.gates.map((gate) => (
          <fieldset key={gate.id} className="v1-fieldset v1-gate">
            <legend className="v1-legend">
              {gate.prompt[language]}{' '}
              <span className="v1-optional">{copy.optional}</span>
            </legend>
            {gate.help ? (
              <p className="v1-help">{gate.help[language]}</p>
            ) : null}
            <div className="v1-options">
              {gate.options.map((option) => (
                <label key={option.value} className="v1-option">
                  <input
                    type="radio"
                    name={gate.id}
                    value={option.value}
                    checked={gates[gate.id] === option.value}
                    onChange={() =>
                      setGates((previous) => ({
                        ...previous,
                        [gate.id]: option.value,
                      }))
                    }
                  />
                  <span>{option.label[language]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="v1-urgent">
          <label className="v1-legend" htmlFor="urgent">
            {questionnaire.urgentField.label[language]}{' '}
            <span className="v1-optional">{copy.optional}</span>
          </label>
          <p className="v1-help">{questionnaire.urgentField.help[language]}</p>
          <textarea
            id="urgent"
            className="crisis-textarea"
            maxLength={questionnaire.urgentField.maxLength}
            placeholder={questionnaire.urgentField.placeholder[language]}
            value={urgent}
            onChange={(event) => setUrgent(event.target.value)}
          />
        </div>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        {unanswered > 0 ? (
          <p className="v1-help">{copy.unanswered(unanswered)}</p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={unanswered > 0 || stage === 'working'}
        >
          {stage === 'working' ? copy.working : copy.submit}
        </button>

        {stage === 'working' ? (
          <p className="v1-help" aria-live="polite">
            {copy.workingNote}
          </p>
        ) : null}
      </form>
    </main>
  );
}
