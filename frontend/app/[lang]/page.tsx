import { redirect } from 'next/navigation';
import PageClient from './client';
import { V1_IS_DEFAULT } from '../site';
import V1Page from './v1/page';

const SUPPORTED = ['en', 'es'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

export function generateStaticParams() {
  return SUPPORTED.map((lang) => ({ lang }));
}

/**
 * Which pipeline a parent reaches.
 *
 * Version 1.0 is served here once `NEXT_PUBLIC_V1_DEFAULT` is set; until then
 * this is the pre-existing flow and V1 lives at `/[lang]/v1` for review.
 *
 * A flag rather than deleting the old path, for two reasons. The switch is
 * reversible in one env change if a live report disappoints, which matters when
 * the new pipeline has not yet written a plan for a real family. And the
 * deletion is then a separate, boring commit rather than the same change as the
 * launch — see LAUNCH-READINESS.md, which is where the deletion belongs once
 * this has run in production for a few days.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so flipping it needs a redeploy with
 * `--no-cache`, and needs its `[build.args]` entry and `ARG` line.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUPPORTED.includes(lang as SupportedLang)) {
    redirect('/en');
  }
  if (V1_IS_DEFAULT) {
    return <V1Page params={params} />;
  }
  return <PageClient key={lang} language={lang as SupportedLang} />;
}
