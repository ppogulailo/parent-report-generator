import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parent Action Plan',
  description: 'Generate a Parent Action Plan from a 24-question intake.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
