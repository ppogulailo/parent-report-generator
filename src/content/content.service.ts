import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { loadContent, resolveContentDir } from './content.loader';
import { ContentBundle, Language, PromptTemplates } from './content.types';
import type { Assessment } from './schemas/assessment.schema';
import type {
  Recommendation,
  RecommendationMatrix,
  Tier,
} from './schemas/matrix.schema';
import type {
  ReportSectionConfig,
  ReportSectionsConfig,
} from './schemas/sections.schema';
import type {
  DiscussionGroup,
  Workshop,
  Workshops,
} from './schemas/workshops.schema';

/**
 * Holds the validated content bundle and answers questions about it.
 *
 * Loaded once at boot and never mutated. Every lookup that can fail throws
 * rather than returning undefined: boot validation has already guaranteed these
 * ids resolve, so a miss here is a bug in this class and should say so loudly
 * instead of producing a report with a hole in it.
 */
@Injectable()
export class ContentService implements OnModuleInit {
  private readonly logger = new Logger(ContentService.name);
  private bundle: ContentBundle;

  constructor() {
    this.bundle = loadContent(resolveContentDir());
  }

  onModuleInit(): void {
    const { assessment, matrix, workshops } = this.bundle;
    this.logger.log(
      `content loaded — assessment ${assessment.version} (${assessment.status}), matrix ${matrix.version} (${matrix.status}), methodology ${matrix.methodologyVersion}, ${workshops.workshops.length} workshops, ${matrix.recommendations.length} recommendations`,
    );
    for (const warning of this.bundle.warnings) {
      this.logger.warn(warning);
    }
  }

  get assessment(): Assessment {
    return this.bundle.assessment;
  }

  get workshops(): Workshops {
    return this.bundle.workshops;
  }

  get matrix(): RecommendationMatrix {
    return this.bundle.matrix;
  }

  get sections(): ReportSectionsConfig {
    return this.bundle.sections;
  }

  get templates(): PromptTemplates {
    return this.bundle.templates;
  }

  get warnings(): readonly string[] {
    return this.bundle.warnings;
  }

  recommendation(id: string): Recommendation {
    const found = this.matrix.recommendations.find((r) => r.id === id);
    if (!found) throw new Error(`unknown recommendation id "${id}"`);
    return found;
  }

  workshop(id: string): Workshop {
    const found = this.workshops.workshops.find((w) => w.id === id);
    if (!found) throw new Error(`unknown workshop id "${id}"`);
    return found;
  }

  discussionGroup(id: string): DiscussionGroup {
    const found = this.workshops.discussionGroups.find((g) => g.id === id);
    if (!found) throw new Error(`unknown discussion group id "${id}"`);
    return found;
  }

  tier(id: string): Tier {
    const found = this.matrix.tiers.find((t) => t.id === id);
    if (!found) throw new Error(`unknown tier id "${id}"`);
    return found;
  }

  /** Workshops the methodology forbids at this severity. */
  forbiddenWorkshopIdsAtTier(tierId: string): Set<string> {
    const ids = new Set<string>();
    for (const gate of this.matrix.tierGates) {
      if (!gate.forbiddenAtTiers.includes(tierId)) continue;
      for (const id of gate.workshopIds) ids.add(id);
    }
    return ids;
  }

  /**
   * The sections that apply to one report, in order.
   *
   * A section whose condition does not hold, or which does not apply at this
   * tier, is stripped here — before the model's schema and prompt are built, so
   * the model is never even offered it. That is what keeps the two urgent-only
   * sections conditional and the Sustaining Recovery transition gated.
   */
  sectionsFor(
    tierId: string,
    applies: (section: ReportSectionConfig) => boolean,
  ): ReportSectionConfig[] {
    return this.sections.sections
      .filter((s) => !s.appliesAtTiers || s.appliesAtTiers.includes(tierId))
      .filter((s) => !s.when || applies(s))
      .sort((a, b) => a.order - b.order);
  }

  /** The wording rules in force for one report. */
  requiredWordingFor(tierId: string) {
    return this.workshops.requiredWording.filter(
      (rule) => !rule.appliesAtTiers || rule.appliesAtTiers.includes(tierId),
    );
  }

  /** The domain's client-facing label, which is also its response key. */
  domainLabel(domainId: string, language: Language): string {
    const domain = this.assessment.domains.find((d) => d.id === domainId);
    if (!domain) throw new Error(`unknown domain id "${domainId}"`);
    return domain.label[language];
  }
}
