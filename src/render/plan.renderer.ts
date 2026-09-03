import { Injectable } from '@nestjs/common';
import type { Language } from '@prisma/client';
import type { RenderedSection } from '../generation/generation.service';

/**
 * The saved plan as one self-contained HTML document — no external
 * stylesheets, fonts or images, so the same output prints, downloads, and
 * feeds PDF generation without a network fetch. Rendered ONCE, at completion,
 * and stored: a re-download matches what the parent originally saw even after
 * a content revision. Same approach as the Sustaining Recovery FRAAP.
 *
 * Everything model-written or parent-derived is HTML-escaped on the way out.
 */

export interface RenderInput {
  planId: string;
  language: Language;
  tierLabel: string;
  tierDescription: string;
  domainScores: { label: string; score: number }[];
  sections: RenderedSection[];
  createdAt: Date;
}

const STRINGS = {
  en: {
    title: 'Monitoring & Intervention — Family Risk Assessment & Action Plan',
    overall: 'Overall level',
    domains: 'Concern areas',
    workshopCta: 'Open in ASAP Community',
    generated: 'Plan generated',
    footer:
      'This plan was generated from your answers and is available at its private link for 90 days. Keep this copy for your records.',
    reference: 'Plan reference',
  },
  es: {
    title: 'Monitoreo e Intervención — Evaluación de Riesgo Familiar y Plan de Acción',
    overall: 'Nivel general',
    domains: 'Áreas de preocupación',
    workshopCta: 'Abrir en ASAP Community',
    generated: 'Plan generado',
    footer:
      'Este plan se generó a partir de tus respuestas y está disponible en su enlace privado durante 90 días. Guarda esta copia para tus registros.',
    reference: 'Referencia del plan',
  },
} as const;

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
<title>${esc(t.title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px 28px; background: #ffffff; color: #1e2229;
         font: 15px/1.6 -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 21px; line-height: 1.3; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; border-bottom: 1px solid #e2e5ea; padding-bottom: 6px; }
  h3 { font-size: 15px; margin: 14px 0 4px; }
  p { margin: 8px 0; }
  .meta { color: #5b6472; font-size: 13px; margin-bottom: 18px; }
  .tier { display: inline-block; padding: 3px 12px; border-radius: 999px;
          background: #eef1f5; font-weight: 600; }
  .tier-desc { margin-top: 8px; }
  .scores { margin: 14px 0 4px; padding: 0; list-style: none; }
  .scores li { display: flex; justify-content: space-between; gap: 16px;
               padding: 4px 0; border-bottom: 1px dotted #e2e5ea; }
  ol.plan-list, ul.plan-list { padding-left: 22px; }
  .rec { margin: 12px 0 16px; }
  .rec-area { color: #5b6472; font-size: 12px; text-transform: uppercase;
              letter-spacing: 0.04em; margin: 0; }
  .workshop { margin: 10px 0 14px; }
  .workshop-cat { color: #5b6472; font-size: 12px; text-transform: uppercase;
                  letter-spacing: 0.04em; margin: 0; }
  .workshop a { color: #274c9b; }
  footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e2e5ea;
           color: #5b6472; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>${esc(t.title)}</h1>
    <p class="meta">${esc(t.generated)}: ${esc(date)}</p>
    <p><span class="tier">${esc(t.overall)}: ${esc(input.tierLabel)}</span></p>
    <p class="tier-desc">${esc(input.tierDescription)}</p>
    <h2>${esc(t.domains)}</h2>
    <ul class="scores">
      ${input.domainScores
        .map(
          (d) =>
            `<li><span>${esc(d.label)}</span><strong>${d.score.toFixed(2)}</strong></li>`,
        )
        .join('\n      ')}
    </ul>
  </header>
  ${ordered.map((s) => this.renderSection(s, t)).join('\n')}
  <footer>
    <p>${esc(t.footer)}</p>
    <p>${esc(t.reference)}: ${esc(input.planId)}</p>
  </footer>
</main>
</body>
</html>`;
  }

  private renderSection(
    section: RenderedSection,
    t: (typeof STRINGS)[Language],
  ): string {
    const parts: string[] = [`<section><h2>${esc(section.title)}</h2>`];

    if (section.body) parts.push(paragraphs(section.body));

    if (section.items?.length) {
      // The three-priorities list is ordered by the methodology; other lists
      // are not. The section config's `ordered` flag does not travel with the
      // rendered section, so ordered rendering keys off the known section.
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
        ? `<a href="${esc(workshop.url)}">${esc(workshop.title)}</a> — ${esc(t.workshopCta)}`
        : esc(workshop.title);
      parts.push(
        `<div class="workshop"><p class="workshop-cat">${esc(workshop.category)}</p>` +
          `<h3>${title}</h3>${paragraphs(workshop.whyThisFamily)}</div>`,
      );
    }

    parts.push('</section>');
    return parts.join('\n');
  }
}
