import type { Metadata } from 'next';
import '../globals.css';

// This is the app's ROOT layout. It lives under app/[lang] (not app/) so that
// the locale comes from the static route param — which lets every page be
// statically generated AND lets <html lang> / metadata be correct per locale
// WITHOUT reading request headers (reading headers() would opt the whole app
// into dynamic rendering). The previous app/layout.tsx used headers() for this;
// deriving from params removes that penalty while keeping the same behaviour.
const SUPPORTED = ['en', 'es'] as const;
type SupportedLang = (typeof SUPPORTED)[number];

export function generateStaticParams() {
  return SUPPORTED.map((lang) => ({ lang }));
}

const SITE_URL = 'https://actionplan.asapcommunity.org';

// Localized <head> metadata. These strings are head-only (title/meta), not
// visible on-page copy, and target parent-intent search queries on the
// landing/tool page. Titles ~50–60 chars, descriptions ~140–160 chars.
const META: Record<SupportedLang, { title: string; description: string }> = {
  en: {
    title: 'Worried Your Teen Is Using Drugs? Parent Action Plan',
    description:
      'Worried your teenager is using drugs or alcohol? Answer 24 quick questions and get a free, personalized parent action plan with clear next steps to take now.',
  },
  es: {
    title: '¿Tu hijo consume drogas? Plan de acción para padres',
    description:
      '¿Te preocupa que tu hijo adolescente consuma drogas o alcohol? Responde 24 preguntas breves y recibe un plan de acción gratuito y personalizado para padres.',
  },
};

function resolveLang(lang: string): SupportedLang {
  return (SUPPORTED as readonly string[]).includes(lang)
    ? (lang as SupportedLang)
    : 'en';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const { title, description } = META[lang];

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      // Self-referencing canonical per locale.
      canonical: `/${lang}`,
      // Reciprocal hreflang set — identical on both locales — plus x-default.
      languages: {
        en: '/en',
        es: '/es',
        'x-default': '/en',
      },
    },
    // The app is deliberately bilingual through the in-app language toggle
    // (EN/ES). Browser auto-translation must NEVER run: it silently makes the
    // displayed language diverge from the selected/generated language. The
    // toggle is the single source of truth, so we suppress the browser's
    // "translate this page?" behaviour app-wide.
    other: { google: 'notranslate' },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  // <html lang> is the displayed language (source of truth), derived from the
  // static route locale — not a hardcoded default and not a request header.
  // translate="no" keeps browser auto-translation off so the displayed
  // language can never diverge from the selected/generated one.
  const lang = resolveLang((await params).lang);
  return (
    <html lang={lang} translate="no">
      <body>{children}</body>
    </html>
  );
}
