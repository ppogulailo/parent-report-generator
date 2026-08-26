import { ImageResponse } from 'next/og';

// Branded 1200x630 share image, generated at build from the ASAP mark. One per
// locale so link previews match the page language. Copy reuses the on-page
// eyebrow + hero title (client-approved), so nothing new needs sign-off.
export const alt = 'ASAP Community — Family Risk Assessment & Action Plan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'es' }];
}

const COPY: Record<string, { eyebrow: string; title: string }> = {
  en: {
    eyebrow: 'Family Risk Assessment & Action Plan',
    title: 'A calm, clear plan when you need it most',
  },
  es: {
    eyebrow: 'Evaluación de Riesgo Familiar y Plan de Acción',
    title: 'Un plan claro cuando más lo necesitas',
  },
};

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const { eyebrow, title } = COPY[lang] ?? COPY.en;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '96px',
        background: 'linear-gradient(135deg, #fbfaf9 0%, #f0ede9 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Brand row: mark + org name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg width="72" height="72" viewBox="284 34 112 112">
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
        <span
          style={{
            fontSize: '34px',
            fontWeight: 700,
            color: '#14120f',
            letterSpacing: '-0.5px',
          }}
        >
          ASAP Community
        </span>
      </div>

      {/* Eyebrow */}
      <div
        style={{
          marginTop: '64px',
          fontSize: '30px',
          fontWeight: 600,
          color: '#4a8f8c',
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}
      >
        {eyebrow}
      </div>

      {/* Title */}
      <div
        style={{
          marginTop: '20px',
          fontSize: '66px',
          fontWeight: 700,
          lineHeight: 1.1,
          color: '#14120f',
          letterSpacing: '-1.5px',
          maxWidth: '900px',
        }}
      >
        {title}
      </div>
    </div>,
    { ...size },
  );
}
