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

type Scores = {
  domainScores: Record<string, number>;
  topDomains: string[];
};

const EMPTY_REPORT: ReportSections = {
  headlineSummary: '',
  keyPriorities: '',
  whatToAvoid: '',
  next7Days: '',
  encouragement: '',
};

const SECTION_LABELS: Array<[keyof ReportSections, string]> = [
  ['headlineSummary', 'Headline Summary'],
  ['keyPriorities', 'Key Priorities'],
  ['whatToAvoid', 'What to Avoid'],
  ['next7Days', 'Next 7 Days'],
  ['encouragement', 'Encouragement & Direction'],
];

const SECTION_MARKERS: Array<[keyof ReportSections, string]> = [
  ['headlineSummary', 'HEADLINE SUMMARY'],
  ['keyPriorities', 'KEY PRIORITIES'],
  ['whatToAvoid', 'WHAT TO AVOID'],
  ['next7Days', 'NEXT 7 DAYS ACTION PLAN'],
  ['encouragement', 'ENCOURAGEMENT & DIRECTION'],
];

function parsePartialSections(text: string): ReportSections {
  const hits: Array<{
    key: keyof ReportSections;
    labelStart: number;
    bodyStart: number;
  }> = [];

  for (const [key, label] of SECTION_MARKERS) {
    const idx = text.indexOf(label);
    if (idx !== -1) {
      hits.push({ key, labelStart: idx, bodyStart: idx + label.length });
    }
  }

  hits.sort((a, b) => a.labelStart - b.labelStart);

  const out: ReportSections = { ...EMPTY_REPORT };
  for (let i = 0; i < hits.length; i++) {
    const curr = hits[i];
    const nextLabelStart =
      i + 1 < hits.length ? hits[i + 1].labelStart : text.length;
    out[curr.key] = text.slice(curr.bodyStart, nextLabelStart).trim();
  }
  return out;
}

export default function Page() {
  const [responses, setResponses] = useState<Array<number | null>>(
    Array(24).fill(null),
  );
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [report, setReport] = useState<ReportSections>(EMPTY_REPORT);

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
    setStreaming(false);
    setError(null);
    setScores(null);
    setReport(EMPTY_REPORT);

    try {
      const res = await fetch('/api/report/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      if (!res.ok || !res.body) {
        let errText = `Request failed (${res.status})`;
        try {
          const json = await res.json();
          if (json?.error) errText = json.error;
        } catch {
          /* ignore */
        }
        setError(errText);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      setStreaming(true);

      const handleEvent = (eventName: string, dataRaw: string) => {
        let data: any;
        try {
          data = JSON.parse(dataRaw);
        } catch {
          return;
        }
        if (eventName === 'scores') {
          setScores({
            domainScores: data.domainScores,
            topDomains: data.topDomains,
          });
        } else if (eventName === 'text') {
          accumulatedText += data.text ?? '';
          setReport(parsePartialSections(accumulatedText));
        } else if (eventName === 'error') {
          setError(data.error ?? 'Report generation failed.');
        } else if (eventName === 'done') {
          setStreaming(false);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on SSE message boundary
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';

        for (const msg of messages) {
          const lines = msg.split('\n');
          let eventName = 'message';
          let dataParts: string[] = [];
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataParts.push(line.slice(5).trim());
            }
          }
          if (dataParts.length > 0) {
            handleEvent(eventName, dataParts.join('\n'));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const startQuestionnaire = () => {
    document
      .getElementById('questionnaire')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasAnyReport =
    scores !== null ||
    SECTION_LABELS.some(([key]) => report[key].length > 0);

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
        {loading
          ? streaming
            ? 'Writing your plan…'
            : 'Generating…'
          : 'Generate Action Plan'}
      </button>

      <button type="button" className="dev-fill" onClick={fillSample}>
        Fill sample answers
      </button>

      {error && <div className="error">{error}</div>}

      {hasAnyReport && (
        <div className="results">
          {scores && (
            <>
              <h2>Domain Scores</h2>
              <div className="scores">
                {Object.entries(scores.domainScores).map(([name, score]) => (
                  <div key={name} style={{ display: 'contents' }}>
                    <div className="score-name">{name}</div>
                    <div className="score-val">{score.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <h2>Top Priorities</h2>
              <div className="top-domains">
                {scores.topDomains.map((d, i) => (
                  <div className="top-domain" key={d}>
                    {i + 1}. {d}
                  </div>
                ))}
              </div>
            </>
          )}

          <h2>Action Plan</h2>
          {SECTION_LABELS.map(([key, label]) => (
            <div className="section" key={key}>
              <div className="section-title">{label}</div>
              {report[key]}
              {streaming && report[key].length > 0 && (
                <span className="cursor" aria-hidden>
                  ▍
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
