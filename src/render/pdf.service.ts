import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser } from 'playwright-core';

/**
 * Renders the report HTML to PDF with headless Chromium.
 *
 * Why a browser: the report already exists as styled, self-contained HTML, and a
 * browser is the only thing that renders that HTML identically to what the parent
 * saw on screen. A layout-from-scratch PDF library would produce a second,
 * diverging design that the client would then have to review separately.
 *
 * Why it is optional: Chromium roughly doubles the container image. A deployment
 * that does not want it sets `PDF_ENABLED=false`, and the API reports the
 * capability as unavailable rather than pretending. The frontend then offers the
 * browser's own print-to-PDF instead, which is exactly what the Parent Action Plan
 * does today. Nothing silently degrades.
 *
 * The browser is launched lazily on first use and reused, because launching per
 * request costs about a second.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private readonly enabled: boolean;
  private readonly executablePath: string | undefined;

  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  /** Set when a launch has failed, so we stop retrying on every request. */
  private launchFailure: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('PDF_ENABLED', 'true') !== 'false';
    // In Docker we use the distro's Chromium rather than Playwright's download,
    // which keeps the image meaningfully smaller.
    this.executablePath = this.config.get<string>('CHROMIUM_PATH') || undefined;

    this.logger.log(
      this.enabled
        ? `pdf generation enabled${this.executablePath ? ` (chromium at ${this.executablePath})` : ''}`
        : 'pdf generation disabled (PDF_ENABLED=false) — clients will be offered browser print instead',
    );
  }

  /**
   * Whether a PDF can actually be produced. Reported to the frontend so it shows
   * the right button rather than one that fails.
   */
  get available(): boolean {
    return this.enabled && this.launchFailure === null;
  }

  async render(html: string): Promise<Buffer> {
    if (!this.enabled) {
      throw new PdfUnavailableError(
        'PDF generation is disabled in this deployment',
      );
    }
    if (this.launchFailure) {
      throw new PdfUnavailableError(this.launchFailure);
    }

    const browser = await this.getBrowser();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();

      // The HTML is fully self-contained, so there is nothing to fetch and
      // `domcontentloaded` is sufficient. Waiting for `load` or `networkidle`
      // would only add latency.
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      // Print styles, not screen styles — the stylesheet has a @media print block.
      await page.emulateMedia({ media: 'print', colorScheme: 'light' });

      return await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      });
    } finally {
      await context.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;

    // Concurrent first requests must share one launch, not race three.
    this.launching ??= this.launch();

    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  private async launch(): Promise<Browser> {
    try {
      // Imported lazily so a deployment running with PDF_ENABLED=false never needs
      // the module resolvable at all.
      const { chromium } = await import('playwright-core');

      return await chromium.launch({
        executablePath: this.executablePath,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
    } catch (err) {
      this.launchFailure = `chromium could not be launched: ${
        err instanceof Error ? err.message : String(err)
      }`;
      // Warn rather than throw at boot: a broken PDF path must not take down the
      // assessment itself. Parents can still complete it and read their report.
      this.logger.warn(
        `${this.launchFailure} — falling back to browser print for downloads`,
      );
      throw new PdfUnavailableError(this.launchFailure);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
  }
}

export class PdfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfUnavailableError';
  }
}
