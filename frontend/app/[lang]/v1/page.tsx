import { notFound } from 'next/navigation';
import V1Client from './V1Client';

/**
 * The Version 1.0 questionnaire and plan.
 *
 * A separate route from `/[lang]` on purpose: the live questionnaire keeps
 * serving parents on the existing pipeline while this one is reviewed. The
 * switch-over — point `/[lang]` here and delete the old path — is a launch step,
 * not a code change, and is listed in LAUNCH-READINESS.md.
 *
 * The questionnaire is fetched from the backend rather than duplicated here.
 * Two hand-maintained lists of 24 questions is one list too many, and the live
 * frontend having its own copy in `app/questions.ts` is exactly how the two
 * drift.
 */

const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';

export const dynamic = 'force-dynamic';

interface Questionnaire {
  version: string;
  status: string;
  title: { en: string; es: string };
  intro: { en: string; es: string };
  scale: { min: number; max: number };
  questions: {
    id: string;
    order: number;
    prompt: { en: string; es: string };
    options: { value: number; label: { en: string; es: string } }[];
  }[];
  gates: {
    id: string;
    order: number;
    prompt: { en: string; es: string };
    help?: { en: string; es: string };
    options: { value: string; label: { en: string; es: string } }[];
  }[];
  urgentField: {
    id: string;
    maxLength: number;
    label: { en: string; es: string };
    help: { en: string; es: string };
    placeholder: { en: string; es: string };
  };
}

interface Capabilities {
  draft: boolean;
  methodologyVersion: string;
}

async function load<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${NEST_API_URL}/api${path}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // The backend being down is not a 500 here — it is a page that says so.
    return null;
  }
}

export default async function V1Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (lang !== 'en' && lang !== 'es') notFound();

  const [questionnaire, capabilities] = await Promise.all([
    load<Questionnaire>('/assessment/questionnaire'),
    load<Capabilities>('/assessment/capabilities'),
  ]);

  if (!questionnaire) {
    return (
      <main className="rv-unavailable">
        <h1>
          {lang === 'es'
            ? 'El cuestionario no está disponible en este momento.'
            : 'The questionnaire is unavailable right now.'}
        </h1>
        <p>
          {lang === 'es'
            ? 'Vuelve a intentarlo en unos minutos.'
            : 'Please try again in a few minutes.'}
        </p>
      </main>
    );
  }

  return (
    <V1Client
      language={lang}
      questionnaire={questionnaire}
      draft={capabilities?.draft ?? true}
      methodologyVersion={capabilities?.methodologyVersion ?? 'unknown'}
    />
  );
}
