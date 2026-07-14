import type { Metadata } from 'next';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" translate="no">
      <body>{children}</body>
    </html>
  );
}
