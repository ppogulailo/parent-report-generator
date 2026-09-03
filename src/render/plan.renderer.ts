import { Injectable } from '@nestjs/common';
import type { Language } from '@prisma/client';
import type { RenderedSection } from '../generation/generation.service';

/**
 * The saved plan as one self-contained, branded HTML document — no external
 * stylesheets, fonts or images, so the same output prints, downloads, and
 * feeds PDF generation without a network fetch. Rendered ONCE, at completion,
 * and stored: a re-download matches what the parent originally saw even after
 * a content revision.
 *
 * The visual language is the site's: the ASAP house-and-heart mark (teal
 * #4a8f8c, amber #e8a04b), the accent blue #0447ff, and the severity palette
 * the results screen uses. Chromium renders with printBackground, so the
 * colors survive into the PDF.
 *
 * Everything model-written or parent-derived is HTML-escaped on the way out.
 */

export interface RenderInput {
  planId: string;
  language: Language;
  tierId: string;
  tierLabel: string;
  tierDescription: string;
  domainScores: { label: string; score: number }[];
  sections: RenderedSection[];
  createdAt: Date;
}

const STRINGS = {
  en: {
    brand: 'ASAP Community',
    product: 'Monitoring & Intervention — Family Risk Assessment & Action Plan',
    tagline: 'Your personalized action plan',
    overall: 'Overall level',
    domains: 'Your concern areas',
    domainsHint: 'Scored 1–4 from your answers. Higher means more concern.',
    workshopCta: 'Open in ASAP Community',
    generated: 'Generated',
    footer:
      'This plan was generated from your answers and is available at its private link for 90 days. Keep this copy for your records.',
    reference: 'Plan reference',
  },
  es: {
    brand: 'ASAP Community',
    product: 'Monitoreo e Intervención — Evaluación de Riesgo Familiar y Plan de Acción',
    tagline: 'Tu plan de acción personalizado',
    overall: 'Nivel general',
    domains: 'Tus áreas de preocupación',
    domainsHint: 'Puntuadas de 1 a 4 según tus respuestas. Más alto significa más preocupación.',
    workshopCta: 'Abrir en ASAP Community',
    generated: 'Generado',
    footer:
      'Este plan se generó a partir de tus respuestas y está disponible en su enlace privado durante 90 días. Guarda esta copia para tus registros.',
    reference: 'Referencia del plan',
  },
} as const;

/** The site's severity palette: tier chip surface/foreground pairs. */
const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  mild: { bg: '#e9f4ec', fg: '#1f8a4c' },
  moderate: { bg: '#fbf1e3', fg: '#b25e09' },
  serious: { bg: '#fbecea', fg: '#d4351c' },
  critical: { bg: '#fbecea', fg: '#d4351c' },
};

/** Domain-score color, on the same thresholds the results screen uses. */
function scoreColor(score: number): string {
  if (score < 2) return '#2f9e57';
  if (score < 2.75) return '#8a9a3c';
  if (score < 3.4) return '#c07a12';
  return '#cf5a2c';
}

/** The ASAP house-and-heart mark, inlined so nothing is fetched. */
const BRAND_MARK = `<svg width="40" height="40" viewBox="284 34 112 112" role="img" aria-hidden="true"><g transform="translate(340,78)"><path d="M -46 26 L 0 -14 L 46 26" fill="none" stroke="#4a8f8c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M 0 8 C -6 -2 -20 -1 -20 11 C -20 22 -8 30 0 38 C 8 30 20 22 20 11 C 20 -1 6 -2 0 8 Z" fill="#e8a04b"/></g></svg>`;

const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const paragraphs = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

@Injectable()
export class PlanRenderer {
  renderDocument(input: RenderInput): string {
    const t = STRINGS[input.language];
    const tier = TIER_COLORS[input.tierId] ?? TIER_COLORS.moderate;
    const date = input.createdAt.toLocaleDateString(
      input.language === 'es' ? 'es-ES' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric' },
    );

    const ordered = [...input.sections].sort((a, b) => a.order - b.order);

    return `<!doctype html>
<html lang="${input.language}" translate="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.product)}</title>
<style>
  :root { color-scheme: light; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; padding: 34px 30px; background: #ffffff; color: #1e2229;
         font: 14.5px/1.62 'Hanken Grotesk', -apple-system, 'Segoe UI', Roboto,
         Helvetica, Arial, sans-serif; }
  main { max-width: 46rem; margin: 0 auto; }

  /* ── Brand header ── */
  .brandbar { display: flex; align-items: center; gap: 14px;
              padding-bottom: 16px; border-bottom: 3px solid #4a8f8c; }
  .brandbar svg { flex: none; }
  .brand-name { font-weight: 700; font-size: 17px; letter-spacing: 0.01em; }
  .brand-product { font-size: 12.5px; color: #5b6472; margin-top: 2px; }
  .brand-date { margin-left: auto; text-align: right; font-size: 12px;
                color: #5b6472; }

  .tagline { margin: 22px 0 6px; font-size: 22px; font-weight: 600;
             letter-spacing: -0.01em; }

  /* ── Severity ── */
  .tier { display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 999px; font-weight: 600;
          font-size: 14px; background: ${tier.bg}; color: ${tier.fg}; }
  .tier::before { content: ''; width: 8px; height: 8px; border-radius: 50%;
                  background: ${tier.fg}; }
  .tier-desc { margin: 10px 0 0; color: #3a4150; }

  /* ── Domain scores ── */
  .domains-head { margin: 26px 0 2px; font-size: 15px; font-weight: 600; }
  .domains-hint { margin: 0 0 10px; font-size: 12px; color: #5b6472; }
  .scores { margin: 0; padding: 0; list-style: none; border: 1px solid #e2e5ea;
            border-radius: 12px; overflow: hidden; }
  .scores li { display: flex; align-items: center; gap: 12px;
               padding: 9px 14px; }
  .scores li + li { border-top: 1px solid #eef0f4; }
  .score-label { flex: 1; }
  .score-track { flex: none; display: block; width: 130px; height: 6px;
                 border-radius: 3px; background: #eef0f4; overflow: hidden; }
  .score-fill { display: block; height: 100%; border-radius: 3px; }
  .score-num { flex: none; width: 2.6em; text-align: right;
               font-variant-numeric: tabular-nums; font-weight: 600; }

  /* ── Sections ── */
  section { margin-top: 26px; break-inside: avoid-page; }
  h2 { font-size: 16.5px; margin: 0 0 10px; padding-left: 12px;
       border-left: 4px solid #4a8f8c; letter-spacing: -0.005em; }
  h3 { font-size: 14.5px; margin: 12px 0 4px; }
  p { margin: 8px 0; }
  ol.plan-list, ul.plan-list { padding-left: 22px; margin: 8px 0; }
  ol.plan-list li, ul.plan-list li { margin: 6px 0; }

  .rec { margin: 14px 0; padding: 12px 16px; border: 1px solid #e2e5ea;
         border-radius: 12px; break-inside: avoid; }
  .rec-area { color: #4a8f8c; font-size: 11px; font-weight: 700;
              text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
  .rec h3 { margin-top: 4px; }

  .workshop { margin: 12px 0; padding: 12px 16px; border-radius: 12px;
              background: #f5f7f9; break-inside: avoid; }
  .workshop-cat { color: #b2610f; font-size: 11px; font-weight: 700;
                  text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
  .workshop h3 { margin-top: 4px; }
  .workshop a { color: #0447ff; text-decoration: none; }
  .workshop-cta { display: inline-block; margin-top: 2px; font-size: 12.5px;
                  color: #0447ff; }

  .static-note { background: #f2f7f6; border-radius: 12px; padding: 4px 16px 10px;
                 border: 1px solid #dcebe9; }

  footer { margin-top: 34px; padding-top: 14px; border-top: 1px solid #e2e5ea;
           color: #5b6472; font-size: 11.5px; display: flex; gap: 12px;
           align-items: flex-start; }
  footer svg { flex: none; opacity: 0.85; }
  footer p { margin: 2px 0; }
</style>
</head>
<body>
<main>
  <header>
    <div class="brandbar">
      ${BRAND_MARK}
      <div>
        <div class="brand-name">${esc(t.brand)}</div>
        <div class="brand-product">${esc(t.product)}</div>
      </div>
      <div class="brand-date">${esc(t.generated)}<br><strong>${esc(date)}</strong></div>
    </div>
    <h1 class="tagline">${esc(t.tagline)}</h1>
    <p><span class="tier">${esc(t.overall)}: ${esc(input.tierLabel)}</span></p>
    <p class="tier-desc">${esc(input.tierDescription)}</p>
    ${
      input.domainScores.length > 0
        ? `<div class="domains-head">${esc(t.domains)}</div>
    <p class="domains-hint">${esc(t.domainsHint)}</p>
    <ul class="scores">
      ${input.domainScores
        .map((d) => {
          const color = scoreColor(d.score);
          const pct = Math.round(((d.score - 1) / 3) * 100);
          return `<li><span class="score-label">${esc(d.label)}</span><span class="score-track"><span class="score-fill" style="width:${pct}%;background:${color}"></span></span><span class="score-num" style="color:${color}">${d.score.toFixed(2)}</span></li>`;
        })
        .join('\n      ')}
    </ul>`
        : ''
    }
  </header>
  ${ordered.map((s) => this.renderSection(s, t)).join('\n')}
  <footer>
    ${BRAND_MARK.replace('width="40" height="40"', 'width="26" height="26"')}
    <div>
      <p>${esc(t.footer)}</p>
      <p>${esc(t.reference)}: ${esc(input.planId)} · ${esc(t.brand)}</p>
    </div>
  </footer>
</main>
</body>
</html>`;
  }

  private renderSection(
    section: RenderedSection,
    t: (typeof STRINGS)[Language],
  ): string {
    // The two fixed passages and the closing read as ASAP's own voice; a
    // tinted card sets them apart from the model-written prose around them.
    const isStatic = section.type === 'static';
    const parts: string[] = [
      `<section${isStatic ? ' class="static-note"' : ''}><h2>${esc(section.title)}</h2>`,
    ];

    if (section.body) parts.push(paragraphs(section.body));

    if (section.items?.length) {
      // The three-priorities list is ordered by the methodology; other lists
      // are not.
      const tag = section.key === 'topImmediatePriorities' ? 'ol' : 'ul';
      parts.push(
        `<${tag} class="plan-list">${section.items
          .map((item) => `<li>${esc(item)}</li>`)
          .join('')}</${tag}>`,
      );
    }

    for (const rec of section.recommendations ?? []) {
      parts.push(
        `<div class="rec"><p class="rec-area">${esc(rec.title)}</p>` +
          `<h3>${esc(rec.headline)}</h3>${paragraphs(rec.body)}</div>`,
      );
    }

    for (const workshop of section.workshops ?? []) {
      const title = workshop.url
        ? `<a href="${esc(workshop.url)}">${esc(workshop.title)}</a>`
        : esc(workshop.title);
      const cta = workshop.url
        ? `<a class="workshop-cta" href="${esc(workshop.url)}">${esc(t.workshopCta)} →</a>`
        : '';
      parts.push(
        `<div class="workshop"><p class="workshop-cat">${esc(workshop.category)}</p>` +
          `<h3>${title}</h3>${paragraphs(workshop.whyThisFamily)}${cta}</div>`,
      );
    }

    parts.push('</section>');
    return parts.join('\n');
  }
}
