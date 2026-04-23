import { redirect } from 'next/navigation';
import PageClient from './client';

const SUPPORTED = ['en', 'es'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

export function generateStaticParams() {
  return SUPPORTED.map((lang) => ({ lang }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUPPORTED.includes(lang as SupportedLang)) {
    redirect('/en');
  }
  return <PageClient language={lang as SupportedLang} />;
}
