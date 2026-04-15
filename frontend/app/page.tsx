'use client';

import { useState } from 'react';
import { QUESTIONS, SCALE_LABELS } from './questions';

type ReportSections = {
  headlineSummary: string;
  keyPriorities: string;
  whatToAvoid: string;
  next7Days: string;
  encouragement: string;
};

type SuccessResponse = {
  success: true;
  domainScores: Record<string, number>;
  topDomains: string[];
  report: ReportSections;
};

type ErrorResponse = { success: false; error: string };
type ApiResponse = SuccessResponse | ErrorResponse;

const SECTION_LABELS: Array<[keyof ReportSections, string]> = [
  ['headlineSummary', 'Headline Summary'],
  ['keyPriorities', 'Key Priorities'],
  ['whatToAvoid', 'What to Avoid'],
  ['next7Days', 'Next 7 Days'],
  ['encouragement', 'Encouragement & Direction'],
];

export default function Page() {
  const [responses, setResponses] = useState<Array<number | null>>(
    Array(24).fill(null),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessResponse | null>(null);

  const allAnswered = responses.every((v) => v !== null);

  const setAnswer = (idx: number, value: number) => {
    setResponses((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const fillSample = () => {
    setResponses([
      4, 3, 4, 2, 3, 2, 3, 3, 4, 4, 2, 3, 2, 2, 3, 2, 4, 2, 2, 2, 2, 2, 4, 3,
    ]);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      const json: ApiResponse = await res.json();
      if (!res.ok || !json.success) {
        setError('error' in json ? json.error : `Request failed (${res.status})`);
      } else {
        setResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  const startQuestionnaire = () => {
    document
      .getElementById('questionnaire')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Parent Action Plan</p>
        <h1>A calm, clear plan when you need it most</h1>
        <p className="hero-sub">
          This tool helps parents quickly create a clear, step-by-step action
          plan to support their child dealing with substance use — in just a
          few minutes.
        </p>
        <ul className="benefits">
          <li>Understand what steps to take immediately</li>
          <li>Get a structured plan tailored to your situation</li>
          <li>Move forward with clarity and confidence</li>
        </ul>
        <p className="meta">24 short questions · About 3 minutes · Confidential</p>
        <p className="reassure">
          You are in the right place. Start when you are ready.
        </p>
        <button
          type="button"
          className="cta-start"
          onClick={startQuestionnaire}
        >
          Start the questionnaire
        </button>
      </section>

      <section id="questionnaire">
        <h2 className="section-heading">A few questions about your situation</h2>
        <p className="section-sub">
          Answer each on a 1–4 scale. 1 means things feel strong or healthy. 4
          means things feel concerning. There are no right or wrong answers —
          your honest responses help shape the plan.
        </p>
      </section>

      {QUESTIONS.map((q, i) => (
        <div className="question" key={i}>
          <label className="question-label">
            <strong>Q{i + 1}.</strong> {q}
          </label>
          <div className="scale">
            {[1, 2, 3, 4].map((v) => (
              <label key={v}>
                <input
                  type="radio"
                  name={`q-${i}`}
                  value={v}
                  checked={responses[i] === v}
                  onChange={() => setAnswer(i, v)}
                />
                <span>{SCALE_LABELS[v]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="submit"
        disabled={!allAnswered || loading}
        onClick={submit}
      >
        {loading ? 'Generating…' : 'Generate Action Plan'}
      </button>

      <button type="button" className="dev-fill" onClick={fillSample}>
        Fill sample answers
      </button>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="results">
          <h2>Domain Scores</h2>
          <div className="scores">
            {Object.entries(result.domainScores).map(([name, score]) => (
              <div key={name} style={{ display: 'contents' }}>
                <div className="score-name">{name}</div>
                <div className="score-val">{score.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <h2>Top Priorities</h2>
          <div className="top-domains">
            {result.topDomains.map((d, i) => (
              <div className="top-domain" key={d}>
                {i + 1}. {d}
              </div>
            ))}
          </div>

          <h2>Action Plan</h2>
          {SECTION_LABELS.map(([key, label]) => (
            <div className="section" key={key}>
              <div className="section-title">{label}</div>
              {result.report[key]}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
