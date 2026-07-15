'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ANSWER_LABELS,
  Language,
  QUESTIONS,
  SECTION_LABELS_BY_LANG,
  SECTION_MARKERS_BY_LANG,
  STRINGS,
  TIERS,
  SeverityTier,
  domainLabel,
  domainDescription,
} from '../i18n';

// Keep in sync with the backend DTO (src/report/dto/generate-report.dto.ts).
const CRISIS_MAX_LENGTH = 1500;

// Display-only grouping of the 24 questions into concern domains (from the
// "Redesign (1)" design). Scoring is unaffected — the backend scores the flat
// responses array by index; this only organizes how questions are shown.
const QUESTION_DOMAIN: string[] = [
  'Immediate Safety & Urgency', // Q1
  'Immediate Safety & Urgency', // Q2
  'Communication & Conflict', // Q3
  'Immediate Safety & Urgency', // Q4
  'Communication & Conflict', // Q5
  'Communication & Conflict', // Q6
  'Boundary Consistency', // Q7
  'Boundary Consistency', // Q8
  'Immediate Safety & Urgency', // Q9
  'Immediate Safety & Urgency', // Q10
  'Boundary Consistency', // Q11
  'Immediate Safety & Urgency', // Q12
  'Communication & Conflict', // Q13
  'Boundary Consistency', // Q14
  'Support & Professional Engagement', // Q15
  'Support & Professional Engagement', // Q16
  'Support & Professional Engagement', // Q17
  'Boundary Consistency', // Q18
  'Communication & Conflict', // Q19
  'Boundary Consistency', // Q20
  'Immediate Safety & Urgency', // Q21
  'Boundary Consistency', // Q22
  'Support & Professional Engagement', // Q23
  'Support & Professional Engagement', // Q24
];
const DOMAIN_ORDER = [
  'Immediate Safety & Urgency',
  'Household Structure',
  'Boundary Consistency',
  'Communication & Conflict',
  'Support & Professional Engagement',
];
// 1→4 severity swatch colors (green → olive → orange → red).
const SEV_COLORS = ['#2f9e57', '#8a9a3c', '#c07a12', '#cf5a2c'];

type ReportSections = {
  urgentConcern: string;
  headlineSummary: string;
  topImmediatePriorities: string;
  keyPriorities: string;
  whatToAvoid: string;
  first72Hours: string;
  days4to7: string;
  consideringInpatient: string;
  encouragement: string;
};

type Scores = {
  domainScores: Record<string, number>;
  topDomains: string[];
};

type Stage = 'idle' | 'scoring' | 'writing' | 'done';

const EMPTY_REPORT: ReportSections = {
  urgentConcern: '',
  headlineSummary: '',
  topImmediatePriorities: '',
  keyPriorities: '',
  whatToAvoid: '',
  first72Hours: '',
  days4to7: '',
  consideringInpatient: '',
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
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^\d+[.)]?\s*$/.test(l));
  const listLines = lines.filter((l) => /^([-•*]|\d+[.)])\s+/.test(l));
  const isMostlyList =
    lines.length > 1 && listLines.length >= Math.ceil(lines.length * 0.6);

  if (isMostlyList) {
    return (
      <ul className="section-list">
        {lines.map((l, i) => {
          const m = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
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

// ── Inline icons ─────────────────────────────────────────────
const CheckIcon = ({ size = 11, stroke = 'currentColor' }: { size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 12.5 9.5 18 20 6" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const WarningIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 9v4m0 4h.01M10.3 3.86 1.8 18a1.5 1.5 0 0 0 1.3 2.25h17.8A1.5 1.5 0 0 0 22.2 18L13.7 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spinner = ({ size = 16 }: { size?: number }) => (
  <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const ChevronDown = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
    <path d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
const LockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

const TIER_COLORS: Record<SeverityTier, { bg: string; fg: string }> = {
  MILD: { bg: 'var(--positive-surface)', fg: 'var(--positive)' },
  MODERATE: { bg: 'var(--warning-surface)', fg: 'var(--warning)' },
  SERIOUS: { bg: 'var(--negative-surface)', fg: 'var(--negative)' },
};

function barColorFor(score: number): string {
  if (score < 2) return '#2f9e57';
  if (score < 2.75) return '#8a9a3c';
  if (score < 3.4) return '#c07a12';
  return '#cf5a2c';
}

type Props = { language: Language };

export default function PageClient({ language }: Props) {
  const [responses, setResponses] = useState<Array<number | null>>(Array(24).fill(null));
  const [crisis, setCrisis] = useState<string>('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [severity, setSeverity] = useState<SeverityTier | null>(null);
  const [report, setReport] = useState<ReportSections>(EMPTY_REPORT);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [showTopProgress, setShowTopProgress] = useState(false);

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const answeredCount = responses.filter((v) => v !== null).length;
  const allAnswered = answeredCount === 24;
  const progressPct = Math.round((answeredCount / 24) * 100);
  const loading = stage === 'scoring' || stage === 'writing';

  const t = STRINGS[language];
  const questions = QUESTIONS[language];
  const answerLabels = ANSWER_LABELS[language];
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

  const startOver = () => {
    setResponses(Array(24).fill(null));
    setCrisis('');
    setStage('idle');
    setError(null);
    setScores(null);
    setSeverity(null);
    setReport(EMPTY_REPORT);
    setExpandedDomain(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onPrint = () => window.print();

  const toggleDomain = (name: string) =>
    setExpandedDomain((prev) => (prev === name ? null : name));

  const submit = async () => {
    setStage('scoring');
    setError(null);
    setScores(null);
    setSeverity(null);
    setReport(EMPTY_REPORT);

    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    try {
      const trimmedCrisis = crisis.trim();
      const payload: {
        responses: Array<number | null>;
        language: Language;
        crisis?: string;
      } = { responses, language };
      if (trimmedCrisis.length > 0) payload.crisis = trimmedCrisis;

      const res = await fetch('/api/report/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          setScores({ domainScores: data.domainScores, topDomains: data.topDomains });
          if (data.severity) setSeverity(data.severity as SeverityTier);
          setStage('writing');
        } else if (eventName === 'text') {
          accumulatedText += data.text ?? '';
          setReport(parsePartialSections(accumulatedText, sectionMarkers));
        } else if (eventName === 'reset') {
          accumulatedText = '';
          setReport(EMPTY_REPORT);
        } else if (eventName === 'error') {
          accumulatedText = '';
          setReport(EMPTY_REPORT);
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
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataParts.push(line.slice(5).trim());
          }
          if (dataParts.length > 0) handleEvent(eventName, dataParts.join('\n'));
        }
      }

      setStage((s) => (s === 'writing' ? 'done' : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
      setStage('idle');
    }
  };

  const startQuestionnaire = () => {
    document.getElementById('questionnaire')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToFirstUnanswered = () => {
    const idx = responses.findIndex((v) => v === null);
    if (idx >= 0)
      document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const hasAnyReport =
    stage !== 'idle' ||
    scores !== null ||
    sectionLabels.some(([key]) => report[key as keyof ReportSections].length > 0);

  useEffect(() => {
    document.documentElement.lang = language;
    // Keep browser auto-translation off (source of truth is the toggle, not a
    // browser translation of the page). Belt-and-suspenders with the SSR
    // <html translate="no"> set in the root layout.
    document.documentElement.setAttribute('translate', 'no');
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', 'true');
    let initial: 'light' | 'dark' = 'light';
    try {
      const stored = localStorage.getItem('apap-theme');
      if (stored === 'dark' || stored === 'light') initial = stored;
      else if (window.matchMedia('(prefers-color-scheme: dark)').matches) initial = 'dark';
    } catch {
      /* ignore */
    }
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('apap-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setShowTopProgress((window.scrollY || 0) > 70);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitLabel = loading ? (stage === 'scoring' ? t.scoring : t.writing) : t.generate;
  const statusHeading =
    stage === 'scoring' ? t.scoringTitle : stage === 'writing' ? t.writingTitle : t.doneTitle;
  const statusSub =
    stage === 'scoring' ? t.scoringSub : stage === 'writing' ? t.writingSub : t.doneSub;

  // Build display-only domain groups (skip empties), with sequential numbering.
  let displayNo = 0;
  const groups = DOMAIN_ORDER.map((name) => ({
    name,
    indices: QUESTION_DOMAIN.map((d, i) => (d === name ? i : -1)).filter((i) => i >= 0),
  }))
    .filter((g) => g.indices.length > 0)
    .map((g, gi) => {
      const answered = g.indices.filter((i) => responses[i] !== null).length;
      const items = g.indices.map((i) => ({ i, number: ++displayNo }));
      return { ...g, gi, answered, total: g.indices.length, items };
    });

  return (
    <>
      {/* Brand bar */}
      <header className="brandbar no-print">
        <div className="brandbar-inner">
          <div className="brand">
            <svg
              className="brand-mark"
              viewBox="284 34 112 112"
              role="img"
              aria-hidden
            >
              <g transform="translate(340,78)">
                <path
                  d="M -46 26 L 0 -14 L 46 26"
                  fill="none"
                  stroke="#4a8f8c"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 0 8 C -6 -2 -20 -1 -20 11 C -20 22 -8 30 0 38 C 8 30 20 22 20 11 C 20 -1 6 -2 0 8 Z"
                  fill="#e8a04b"
                />
              </g>
            </svg>
            <span>ASAP Community</span>
          </div>
          <div className="brandbar-controls">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <nav className="langswitch" aria-label={t.languageLabel} role="radiogroup">
              {(['en', 'es'] as Language[]).map((code) => (
                <Link
                  key={code}
                  href={`/${code}`}
                  role="radio"
                  aria-checked={language === code}
                  aria-disabled={loading}
                  tabIndex={loading ? -1 : 0}
                  className={`lang-label${language === code ? ' active' : ''}${loading ? ' disabled' : ''}`}
                  prefetch={false}
                  onClick={(e) => {
                    if (loading) e.preventDefault();
                  }}
                >
                  <span>{code.toUpperCase()}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Sticky global progress bar (after scrolling past hero) */}
      <div
        className={`topbar no-print${showTopProgress ? ' visible' : ''}`}
        role="button"
        tabIndex={showTopProgress ? 0 : -1}
        aria-label={`${t.answeredOf(answeredCount)}${allAnswered ? '' : ' — ' + t.jumpToNext}`}
        onClick={jumpToFirstUnanswered}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            jumpToFirstUnanswered();
          }
        }}
      >
        <div className="topbar-inner">
          <span className="topbar-count">
            <span>{answeredCount} / 24</span>
          </span>
          <div className="topbar-track" aria-hidden>
            <div className="topbar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="topbar-pct">
            <span>{progressPct}%</span>
          </span>
        </div>
      </div>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="orb" aria-hidden />
          <div className="orb-2" aria-hidden />
          <div className="hero-inner">
            <p className="eyebrow rise">{t.eyebrow}</p>
            <h1 className="hero-title">{t.title}</h1>
            <p className="hero-sub">{t.heroSub}</p>
            <ul className="benefits">
              {t.benefits.map((b, i) => (
                <li key={i} className="benefit">
                  <span className="benefit-check" aria-hidden>
                    <CheckIcon />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary cta-shine" onClick={startQuestionnaire}>
              <span>{t.ctaStart}</span>
            </button>
            <p className="hero-meta">{t.meta}</p>
            <p className="hero-reassure">
              <span className="reassure-dot" aria-hidden />
              <span>{t.reassure}</span>
            </p>
            <div className="trust-chip">
              <LockIcon />
              <span>{t.trustLine}</span>
            </div>
            {!showTopProgress && (
              <div className="scrollcue no-print">
                <button type="button" onClick={startQuestionnaire} aria-label={t.ctaStart}>
                  <ChevronDown />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Questionnaire */}
        <section className="block" id="questionnaire">
          <h2 className="block-heading">{t.questionnaireHeading}</h2>
          <p className="block-sub">{t.questionnaireSub}</p>

          <div className="scale-legend">
            <span>{t.severityLegend}</span>
            <span className="scale-swatches" aria-hidden>
              {SEV_COLORS.map((c) => (
                <span key={c} className="scale-swatch" style={{ background: c }} />
              ))}
            </span>
            <span>{t.severityLegendHigh}</span>
          </div>

          <div className="progress no-print">
            <div className="progress-row">
              <span className="progress-label">
                <span>{t.answeredOf(answeredCount)}</span>
              </span>
              {!allAnswered && answeredCount > 0 && (
                <button type="button" className="progress-jump" onClick={jumpToFirstUnanswered}>
                  <span>{t.jumpToNext}</span>
                </button>
              )}
            </div>
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="qgroups">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="qgroup-head">
                  <span className="qgroup-badge">{g.gi + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="qgroup-title">{domainLabel(language, g.name)}</h3>
                    <p className="qgroup-desc">{domainDescription(language, g.name)}</p>
                  </div>
                  <span
                    className="qgroup-count"
                    style={{
                      color: g.answered === g.total ? 'var(--positive)' : 'var(--grey-500)',
                    }}
                  >
                    {g.answered}/{g.total}
                  </span>
                </div>
                <div className="qgroup-questions">
                  {g.items.map(({ i, number }) => {
                    const selected = responses[i];
                    const answered = selected !== null;
                    return (
                      <div className={`qcard${answered ? ' answered' : ''}`} key={i} id={`q-${i}`}>
                        <div className="qcard-head">
                          <span className="qbadge">
                            {number}
                            {answered && (
                              <span className="qbadge-check" aria-hidden>
                                <CheckIcon size={7} stroke="white" />
                              </span>
                            )}
                          </span>
                          <p className="qtext">{questions[i]}</p>
                        </div>
                        <div className="opts" role="radiogroup" aria-label={questions[i]}>
                          {[1, 2, 3, 4].map((v) => {
                            const checked = selected === v;
                            const c = SEV_COLORS[v - 1];
                            return (
                              <label
                                key={v}
                                className="opt"
                                style={
                                  checked
                                    ? {
                                        borderColor: c,
                                        background: `color-mix(in srgb, ${c} 12%, var(--surface))`,
                                      }
                                    : undefined
                                }
                              >
                                <input
                                  type="radio"
                                  className="visually-hidden"
                                  name={`q-${i}`}
                                  value={v}
                                  checked={checked}
                                  onChange={() => setAnswer(i, v)}
                                  aria-label={`${v} — ${answerLabels[i][v - 1]}`}
                                />
                                <span
                                  className="opt-chip"
                                  style={{
                                    borderColor: checked ? c : `color-mix(in srgb, ${c} 45%, var(--border))`,
                                    background: checked ? c : 'transparent',
                                    color: checked ? '#fff' : c,
                                  }}
                                >
                                  {v}
                                </span>
                                <span className="opt-text">{answerLabels[i][v - 1]}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Crisis field */}
        <section className="block" id="crisis-field">
          <div className="crisis-card">
            <h3 className="crisis-heading">{t.crisisHeading}</h3>
            <p className="crisis-intro">{t.crisisIntro}</p>
            <div className="safety-note" role="note">
              <WarningIcon />
              <p>{t.crisisSafetyNotice}</p>
            </div>
            <label className="crisis-fieldlabel" htmlFor="crisis-textarea">
              {t.crisisLabel}
            </label>
            <textarea
              id="crisis-textarea"
              className="crisis-textarea"
              value={crisis}
              onChange={(e) => setCrisis(e.target.value.slice(0, CRISIS_MAX_LENGTH))}
              placeholder={t.crisisPlaceholder}
              maxLength={CRISIS_MAX_LENGTH}
              rows={4}
              disabled={loading}
            />
            <div className="crisis-count" aria-live="polite">
              <span>{t.crisisHint(CRISIS_MAX_LENGTH - crisis.length)}</span>
            </div>
          </div>
        </section>

        {/* Generate */}
        <section className="generate">
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={!allAnswered || loading}
            onClick={submit}
            aria-busy={loading}
          >
            {loading && <Spinner />}
            <span>{submitLabel}</span>
          </button>
          {!allAnswered && (
            <p className="generate-hint">
              <span>{t.submitHint}</span>
            </p>
          )}
        </section>

        {error && (
          <div className="error" role="alert">
            <strong>{t.errorHeading}</strong>
            <span>{error}</span>
            <button type="button" className="btn btn-secondary" onClick={submit}>
              <span>{t.retry}</span>
            </button>
          </div>
        )}

        {/* Results — translate="no" is PERMANENT: the plan is generated in the
            selected language and must never be re-translated by the browser
            (prevents the streaming/insertBefore crash). */}
        {hasAnyReport && (
          <div className="results" translate="no" ref={resultsRef}>
            <section aria-live="polite">
              <div className={`status-card${loading ? ' working' : ''}${stage === 'done' ? ' done' : ''}`}>
                {loading && <Spinner size={22} />}
                {stage === 'done' && (
                  <span className="status-check" aria-hidden>
                    <CheckIcon size={12} />
                  </span>
                )}
                <div>
                  <p className="status-heading">
                    <span>{statusHeading}</span>
                  </p>
                  <p className="status-sub">
                    <span>{statusSub}</span>
                  </p>
                </div>
              </div>

              {scores && severity && (
                <div className="level-card" style={{ background: TIER_COLORS[severity].bg }}>
                  <span className="level-tag" style={{ background: TIER_COLORS[severity].fg }}>
                    {TIERS[language][severity].label}
                  </span>
                  <div>
                    <p className="level-overline" style={{ color: TIER_COLORS[severity].fg }}>
                      {t.planLevelLabel}
                    </p>
                    <p className="level-desc">{TIERS[language][severity].desc}</p>
                  </div>
                </div>
              )}

              {scores && (
                <>
                  <div className="results-group">
                    <h3 className="results-group-heading">{t.domainScoresHeading}</h3>
                    <p className="block-sub" style={{ marginBottom: 14 }}>{t.domainScoresHint}</p>
                    <div className="scores">
                      {Object.entries(scores.domainScores).map(([name, score]) => {
                        const open = expandedDomain === name;
                        const desc = domainDescription(language, name);
                        return (
                          <div className={`domain-card${open ? ' open' : ''}`} key={name}>
                            <button
                              type="button"
                              className="domain-card-btn"
                              aria-expanded={open}
                              onClick={() => toggleDomain(name)}
                            >
                              <span className="domain-chevron">
                                <ChevronRight />
                              </span>
                              <div className="domain-card-main">
                                <div className="domain-card-top">
                                  <span className="domain-card-name">{domainLabel(language, name)}</span>
                                  <span className="domain-card-score">{score.toFixed(2)}</span>
                                </div>
                                <div className="domain-card-track">
                                  <div
                                    className="domain-card-fill"
                                    style={{
                                      width: `${Math.max(4, ((score - 1) / 3) * 100)}%`,
                                      background: barColorFor(score),
                                    }}
                                  />
                                </div>
                              </div>
                            </button>
                            {open && desc && <p className="domain-card-desc">{desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="results-group">
                    <h3 className="results-group-heading">{t.topPrioritiesHeading}</h3>
                    <div className="top-domains">
                      {scores.topDomains.map((d, i) => (
                        <div className="top-domain" key={d}>
                          <span className="top-rank">{i + 1}</span>
                          <span className="top-domain-name">{domainLabel(language, d)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <h3 className="results-group-heading">{t.actionPlanHeading}</h3>
              <div className="sections">
                {sectionLabels.map(([key, label]) => {
                  const body = report[key as keyof ReportSections];
                  // urgentConcern and consideringInpatient are conditional
                  // (crisis report only) — skip their cards entirely when empty
                  // so non-crisis plans don't render an empty section box.
                  if (
                    (key === 'urgentConcern' || key === 'consideringInpatient') &&
                    body.length === 0
                  )
                    return null;
                  const isUrgent = key === 'urgentConcern';
                  const isActive = stage === 'writing' && body.length > 0;
                  return (
                    <div className={`scard${isUrgent ? ' urgent' : ''}`} key={key}>
                      <div className="scard-head">
                        {isUrgent && <WarningIcon size={17} />}
                        <h4 className="scard-title">{label}</h4>
                      </div>
                      <div className="scard-body">
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
                    </div>
                  );
                })}
              </div>

              {stage === 'done' && (
                <div className="done-actions no-print">
                  <button type="button" className="btn btn-secondary" onClick={onPrint}>
                    <span>{t.printButton}</span>
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={startOver}>
                    <span>{t.startOverButton}</span>
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Prototype tools — development only; never shipped to production
          (Next inlines NODE_ENV, so this block is dropped from prod builds). */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="devtools no-print">
          <span className="devtools-title">Prototype tools</span>
          <button type="button" className="devtools-btn" onClick={fillSample}>
            Prefill sample answers
          </button>
          <button type="button" className="devtools-btn" onClick={startOver}>
            Reset all
          </button>
        </div>
      )}
    </>
  );
}
