import type { Metadata } from 'next';
import { Hanken_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import '../globals.css';

// Self-hosted at build via next/font (no render-blocking Google Fonts @import,
// no layout shift). These are variable fonts, so the full weight axis is
// available without listing weights. The CSS variables are consumed by
// --font-display / --font-sans / --font-mono in globals.css.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
});
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

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

// Factual structured data only — no ratings, medical claims, or unverifiable
// assertions on this health-adjacent topic. Organization + WebSite describe the
// publisher and site; WebApplication describes the free bilingual tool itself.
const APP_DESCRIPTION: Record<SupportedLang, string> = {
  en: 'A free bilingual tool that turns a 24-question intake into a personalized, step-by-step action plan for parents concerned about a child’s substance use.',
  es: 'Una herramienta bilingüe y gratuita que convierte un cuestionario de 24 preguntas en un plan de acción personalizado y paso a paso para padres preocupados por el consumo de sustancias de su hijo.',
};

function buildJsonLd(lang: SupportedLang) {
  const orgId = `${SITE_URL}/#organization`;
  const siteId = `${SITE_URL}/#website`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: 'ASAP Community',
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': siteId,
        url: SITE_URL,
        name: 'ASAP Community Parent Action Plan',
        inLanguage: lang,
        publisher: { '@id': orgId },
      },
      {
        '@type': 'WebApplication',
        name: 'Parent Risk Assessment & Action Plan',
        url: `${SITE_URL}/${lang}`,
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web browser',
        inLanguage: lang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description: APP_DESCRIPTION[lang],
        publisher: { '@id': orgId },
      },
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = resolveLang((await params).lang);
  const { title, description } = META[lang];
  const ogLocale = lang === 'es' ? 'es_ES' : 'en_US';

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: 'ASAP Community Parent Action Plan',
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
    // The og:image / twitter:image tags are injected automatically from
    // app/[lang]/opengraph-image.tsx and twitter-image.tsx — do not duplicate
    // an `images` field here.
    openGraph: {
      type: 'website',
      siteName: 'ASAP Community',
      locale: ogLocale,
      url: `${SITE_URL}/${lang}`,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
    <html
      lang={lang}
      translate="no"
      className={`${hanken.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(lang)) }}
        />
        {children}
      </body>
    </html>
  );
}
