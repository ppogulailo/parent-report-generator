import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import PlanClient from './plan-client';

/**
 * The private return link (Milestone 5). The UUID in the path is the
 * capability: it was shown once, to the family that generated the plan, and
 * possession of it is what authorises reading — and deleting — the plan.
 *
 * The plan itself is fetched client-side through the proxy so a plan still
 * being written can poll to completion; the questionnaire metadata (domain
 * descriptions, PDF capability) is fetched here, server-side, the same way the
 * assessment page does it.
 */

const SUPPORTED = ['en', 'es'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

const NEST_API_URL = process.env.NEST_API_URL ?? 'http://localhost:3000';

export const dynamic = 'force-dynamic';

// A family's plan must never end up in a search index, whatever the site-wide
// setting is.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${NEST_API_URL}/api${path}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!SUPPORTED.includes(lang as SupportedLang)) redirect('/en');
  if (!UUID.test(id)) notFound();

  const [questionnaire, capabilities] = await Promise.all([
    load<{
      domains: {
        label: { en: string; es: string };
        description: { en: string; es: string };
      }[];
    }>('/assessment/questionnaire'),
    load<{ pdf?: boolean }>('/assessment/capabilities'),
  ]);

  const language = lang as SupportedLang;
  // Keyed by the same language-specific label the plan's domainScores use, so
  // an expanded card finds its description.
  const domainDescriptions = Object.fromEntries(
    (questionnaire?.domains ?? []).map((d) => [
      d.label[language],
      d.description[language],
    ]),
  );

  return (
    <PlanClient
      language={language}
      planId={id}
      domainDescriptions={domainDescriptions}
      pdfAvailable={capabilities?.pdf ?? false}
    />
  );
}
