import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parent Action Plan',
  description: 'Generate a Parent Action Plan from a 24-question intake.',
  // The app is deliberately bilingual through the in-app language toggle
  // (EN/ES). Browser auto-translation must NEVER run: it silently makes the
  // displayed language diverge from the selected/generated language — e.g.
  // Chrome rendering the Spanish /es questionnaire in English while the plan is
  // still generated in Spanish. The toggle is the single source of truth, so we
  // suppress the browser's "translate this page?" behaviour app-wide (this is
  // the same rule already applied permanently to the generated results).
  other: { google: 'notranslate' },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware sets x-lang to the active route locale so the server-rendered
  // <html lang> matches the displayed language (source of truth), not a
  // hardcoded default. translate="no" keeps browser auto-translation off so the
  // displayed language can never diverge from the selected/generated one.
  const lang = (await headers()).get('x-lang') ?? 'en';
  return (
    <html lang={lang} translate="no">
      <body>{children}</body>
    </html>
  );
}
