'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Language,
  QUESTIONS,
  SCALE_LABELS,
  SECTION_LABELS_BY_LANG,
  SECTION_MARKERS_BY_LANG,
  STRINGS,
  domainLabel,
} from '../i18n';

type ReportSections = {
  headlineSummary: string;
  topImmediatePriorities: string;
  keyPriorities: string;
  whatToAvoid: string;
  first72Hours: string;
  days4to7: string;
  encouragement: string;
};

type Scores = {
  domainScores: Record<string, number>;
  topDomains: string[];
};

type Stage = 'idle' | 'scoring' | 'writing' | 'done';

const EMPTY_REPORT: ReportSections = {
  headlineSummary: '',
  topImmediatePriorities: '',
  keyPriorities: '',
  whatToAvoid: '',
  first72Hours: '',
  days4to7: '',
  encouragement: '',
};

function parsePartialSections(
  text: string,
  markers: Array<[string, string]>,
): ReportSections {
  const hits: Array<{
    key: keyof ReportSections;
    labelStart: number;
    bodyStart: number;
  }> = [];

  for (const [key, label] of markers) {
    const idx = text.indexOf(label);
    if (idx !== -1) {
      hits.push({
        key: key as keyof ReportSections,
        labelStart: idx,
        bodyStart: idx + label.length,
      });
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

function renderSectionBody(body: string): React.ReactNode {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•*]\s+/.test(l));
  const isMostlyBullets =
    lines.length > 1 && bulletLines.length >= Math.ceil(lines.length * 0.6);

  if (isMostlyBullets) {
    return (
      <ul className="section-list">
        {lines.map((l, i) => {
          const m = l.match(/^[-•*]\s+(.*)$/);
          return <li key={i}>{m ? m[1] : l}</li>;
        })}
      </ul>
    );
  }

  return (
    <>
      {lines.map((l, i) => (
        <p key={i} className="section-para">
          {l}
        </p>
      ))}
    </>
  );
}

type Props = {
  language: Language;
};

export default function PageClient({ language }: Props) {
  const [responses, setResponses] = useState<Array<number | null>>(
    Array(24).fill(null),
  );
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [report, setReport] = useState<ReportSections>(EMPTY_REPORT);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const answeredCount = responses.filter((v) => v !== null).length;
  const allAnswered = answeredCount === 24;
  const progressPct = Math.round((answeredCount / 24) * 100);
  const loading = stage === 'scoring' || stage === 'writing';

  const t = STRINGS[language];
  const questions = QUESTIONS[language];
  const scaleLabels = SCALE_LABELS[language];
  const sectionLabels = SECTION_LABELS_BY_LANG[language];
  const sectionMarkers = SECTION_MARKERS_BY_LANG[language];

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
    setStage('scoring');
    setError(null);
    setScores(null);
    setReport(EMPTY_REPORT);

    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    try {
      const res = await fetch('/api/report/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, language }),
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
        setStage('idle');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

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
          setStage('writing');
        } else if (eventName === 'text') {
          accumulatedText += data.text ?? '';
          setReport(parsePartialSections(accumulatedText, sectionMarkers));
        } else if (eventName === 'error') {
          setError(data.error ?? 'Report generation failed.');
          setStage('idle');
        } else if (eventName === 'done') {
          setStage('done');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';

        for (const msg of messages) {
          const lines = msg.split('\n');
          let eventName = 'message';
          const dataParts: string[] = [];
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

      setStage((s) => (s === 'writing' ? 'done' : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
      setStage('idle');
    }
  };

  const startQuestionnaire = () => {
    document
      .getElementById('questionnaire')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToFirstUnanswered = () => {
    const idx = responses.findIndex((v) => v === null);
    if (idx >= 0) {
      document
        .getElementById(`q-${idx}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const hasAnyReport =
    stage !== 'idle' ||
    scores !== null ||
    sectionLabels.some(
      ([key]) => report[key as keyof ReportSections].length > 0,
    );

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--progress',
      `${progressPct}%`,
    );
  }, [progressPct]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', 'true');
  }, []);

  const submitLabel = loading
    ? stage === 'scoring'
      ? t.scoring
      : t.writing
    : t.generate;

  return (
    <main>
      <nav className="lang-switch" aria-label={t.languageLabel}>
        <div className="lang-switch-inner" role="radiogroup">
          <Link
            href="/en"
            role="radio"
            aria-checked={language === 'en'}
            aria-disabled={loading}
            tabIndex={loading ? -1 : 0}
            className={`lang-pill${language === 'en' ? ' active' : ''}${
              loading ? ' disabled' : ''
            }`}
            prefetch={false}
            onClick={(e) => {
              if (loading) e.preventDefault();
            }}
          >
            <span className="lang-pill-flag" aria-hidden>
              🇺🇸
            </span>
            <span className="lang-pill-code">EN</span>
          </Link>
          <Link
            href="/es"
            role="radio"
            aria-checked={language === 'es'}
            aria-disabled={loading}
            tabIndex={loading ? -1 : 0}
            className={`lang-pill${language === 'es' ? ' active' : ''}${
              loading ? ' disabled' : ''
            }`}
            prefetch={false}
            onClick={(e) => {
              if (loading) e.preventDefault();
            }}
          >
            <span className="lang-pill-flag" aria-hidden>
              🇪🇸
            </span>
            <span className="lang-pill-code">ES</span>
          </Link>
          <div
            className="lang-pill-indicator"
            aria-hidden
            data-lang={language}
          />
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="hero-sub">{t.heroSub}</p>
        <ul className="benefits">
          {t.benefits.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <p className="meta">{t.meta}</p>
        <p className="reassure">{t.reassure}</p>
        <button
          type="button"
          className="cta-start"
          onClick={startQuestionnaire}
        >
          {t.ctaStart}
        </button>
      </section>

      <section id="questionnaire">
        <h2 className="section-heading">{t.questionnaireHeading}</h2>
        <p className="section-sub">{t.questionnaireSub}</p>
      </section>

      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar-fill" />
      </div>
      <div className="progress-label">
        {t.answeredOf(answeredCount)}
        {!allAnswered && answeredCount > 0 && (
          <button
            type="button"
            className="progress-jump"
            onClick={jumpToFirstUnanswered}
          >
            {t.jumpToNext}
          </button>
        )}
      </div>

      {questions.map((q, i) => (
        <div
          className={`question${responses[i] !== null ? ' answered' : ''}`}
          key={i}
          id={`q-${i}`}
        >
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
                <span>{scaleLabels[v]}</span>
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
        aria-busy={loading}
      >
        {loading && <span className="spinner" aria-hidden />}
        {submitLabel}
      </button>

      {!allAnswered && <p className="submit-hint">{t.submitHint}</p>}

      <button type="button" className="dev-fill" onClick={fillSample}>
        {t.fillSample}
      </button>

      {error && (
        <div className="error" role="alert">
          <strong>{t.errorHeading}</strong>
          <span>{error}</span>
          <button type="button" className="retry" onClick={submit}>
            {t.retry}
          </button>
        </div>
      )}

      {hasAnyReport && (
        <div className="results" ref={resultsRef}>
          <div className="results-status" aria-live="polite">
            {stage === 'scoring' && (
              <div className="status-card">
                <span className="spinner big" aria-hidden />
                <div>
                  <div className="status-title">{t.scoringTitle}</div>
                  <div className="status-sub">{t.scoringSub}</div>
                </div>
              </div>
            )}
            {stage === 'writing' && (
              <div className="status-card">
                <span className="spinner big" aria-hidden />
                <div>
                  <div className="status-title">{t.writingTitle}</div>
                  <div className="status-sub">{t.writingSub}</div>
                </div>
              </div>
            )}
            {stage === 'done' && (
              <div className="status-card done">
                <div>
                  <div className="status-title">{t.doneTitle}</div>
                  <div className="status-sub">{t.doneSub}</div>
                </div>
              </div>
            )}
          </div>

          {scores && (
            <>
              <h2>{t.domainScoresHeading}</h2>
              <div className="scores">
                {Object.entries(scores.domainScores).map(([name, score]) => (
                  <div key={name} className="score-row">
                    <div className="score-name">
                      {domainLabel(language, name)}
                    </div>
                    <div className="score-bar-wrap">
                      <div
                        className="score-bar"
                        style={{ width: `${((score - 1) / 3) * 100}%` }}
                      />
                    </div>
                    <div className="score-val">{score.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <h2>{t.topPrioritiesHeading}</h2>
              <div className="top-domains">
                {scores.topDomains.map((d, i) => (
                  <div className="top-domain" key={d}>
                    <span className="top-domain-num">{i + 1}</span>
                    <span>{domainLabel(language, d)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2>{t.actionPlanHeading}</h2>
          {sectionLabels.map(([key, label]) => {
            const body = report[key as keyof ReportSections];
            const isActive = stage === 'writing' && body.length > 0;
            return (
              <div className="section" key={key}>
                <div className="section-title">{label}</div>
                {body.length === 0 ? (
                  <p className="section-placeholder">
                    {stage === 'writing' ? t.writingPlaceholder : ''}
                  </p>
                ) : (
                  <>
                    {renderSectionBody(body)}
                    {isActive && (
                      <span className="cursor" aria-hidden>
                        ▍
                      </span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
