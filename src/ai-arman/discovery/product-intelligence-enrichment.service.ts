import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductIntelligenceClient } from '../integrations/product-intelligence.client';
import {
  ProductIntelligenceAnalysis,
  ProductIntelligenceRequestProduct,
} from '../integrations/product-intelligence.types';
import { RecommendationCandidate } from '../recommendation/recommendation.types';
import { RecommendationScoringService } from '../recommendation/recommendation-scoring.service';

export type ProductIntelligencePreviewRequest = {
  message: string;
  products: ProductIntelligenceRequestProduct[];
};

@Injectable()
export class ProductIntelligenceEnrichmentService {
  constructor(
    private readonly productIntelligenceClient: ProductIntelligenceClient,
    private readonly recommendationScoring: RecommendationScoringService,
  ) {}

  async enrich(request: ProductIntelligencePreviewRequest) {
    const message = String(request?.message || '').trim();
    const products = request?.products;

    if (message.length < 3 || message.length > 1000) {
      throw new BadRequestException(
        'Customer message must contain between 3 and 1000 characters.',
      );
    }

    if (!Array.isArray(products) || products.length === 0) {
      throw new BadRequestException('At least one product is required.');
    }

    if (products.length > 25) {
      throw new BadRequestException('At most 25 products may be evaluated.');
    }

    for (const product of products) {
      if (!String(product?.productId || '').trim()) {
        throw new BadRequestException('Every product requires productId.');
      }
      if (!String(product?.title || '').trim()) {
        throw new BadRequestException('Every product requires title.');
      }
    }

    const lookup = await this.productIntelligenceClient.evaluate(message, products);
    const byProductId = new Map(
      lookup.analyses.map((analysis) => [analysis.productId, analysis]),
    );

    const candidates = products.map((product) => {
      const analysis = byProductId.get(product.productId);
      return analysis
        ? this.toCandidate(product, analysis)
        : this.toBlockedCandidate(product, lookup.error);
    });

    const ranked = this.recommendationScoring.rankCandidates(candidates);
    const eligible = ranked.filter((candidate) => candidate.eligible);
    const rejected = ranked.filter((candidate) => !candidate.eligible);

    return {
      ok: lookup.ok,
      mode: 'product-intelligence-preview',
      source: {
        service: 'product-intelligence',
        configured: lookup.configured,
        durationMs: lookup.durationMs,
        upstreamStatus: lookup.upstreamStatus,
        engineVersion: lookup.engineVersion,
        generatedAt: lookup.generatedAt,
        error: lookup.error,
      },
      verification: lookup.verification
        ? {
            enabled: lookup.verification.enabled,
            attempted: lookup.verification.attempted,
            required: lookup.verification.required,
            reason: lookup.verification.reason,
            model: lookup.verification.model,
            webSearchUsed: lookup.verification.webSearchUsed,
            cacheHit: lookup.verification.cacheHit,
            error: lookup.verification.error,
            usage: lookup.verification.usage,
            products: lookup.verification.products.map((product) => ({
              productId: product.productId,
              verdict: product.verdict,
              summary: product.summary,
              recommendationAction: product.recommendationAction,
              confidence: this.normalizeConfidence(product.confidence),
              ingredientFindings: this.strings(product.ingredientFindings),
              problemSolving: this.strings(product.problemSolving),
              cautions: this.strings(product.cautions),
              sources: product.sources,
              cached: product.cached,
            })),
          }
        : null,
      summary: {
        requested: products.length,
        analyzed: lookup.analyses.length,
        eligible: eligible.length,
        rejected: rejected.length,
      },
      recommendations: eligible.slice(0, 3),
      rejected,
      safety: {
        readOnly: true,
        liveProductFactsVerified: false,
        productionActionsEnabled: false,
        deterministicBlockersAuthoritative: true,
        rule:
          'A product becomes recommendation-ready only when designation, original INCI, evidence, confidence and engine version are valid. OpenAI may add evidence or blockers but never remove deterministic blockers.',
      },
    };
  }

  private toCandidate(
    product: ProductIntelligenceRequestProduct,
    analysis: ProductIntelligenceAnalysis,
  ): RecommendationCandidate {
    const validationBlockers = this.validateAnalysis(analysis);

    return {
      productId: product.productId,
      title: product.title,
      scores: {
        designation: this.clamp(analysis.designation.score),
        inciSuitability: this.clamp(analysis.inci.suitabilityScore),
        category: this.clamp(analysis.category.score),
        tags: this.clamp(analysis.tags.score),
      },
      hardBlockers: [
        ...validationBlockers,
        ...(Array.isArray(analysis.hardBlockers) ? analysis.hardBlockers : []),
      ],
      personalizationScore: 0,
      evidence: {
        designationReasons: this.strings(analysis.designation.reasons),
        inciSignals: this.strings(analysis.inci.signals),
        categoryReasons: this.strings(analysis.category.reasons),
        tagReasons: this.strings(analysis.tags.reasons),
        limitations: this.strings([
          ...analysis.limitations,
          ...analysis.inci.conflicts,
          'Price and stock are not yet verified against Vendre.',
        ]),
        confidence: this.normalizeConfidence(analysis.inci.confidence),
        engineVersion: analysis.inci.engineVersion,
      },
    };
  }

  private validateAnalysis(analysis: ProductIntelligenceAnalysis): string[] {
    const blockers: string[] = [];

    if (!String(analysis.designation?.normalized || '').trim()) {
      blockers.push('missing_normalized_designation');
    }

    if (!String(analysis.inci?.original || '').trim()) {
      blockers.push('missing_original_inci');
    }

    if (!String(analysis.inci?.engineVersion || '').trim()) {
      blockers.push('missing_ingredient_engine_version');
    }

    if (!String(analysis.inci?.analyzedAt || '').trim()) {
      blockers.push('missing_ingredient_analysis_timestamp');
    }

    if (!Array.isArray(analysis.evidence) || analysis.evidence.length === 0) {
      blockers.push('missing_product_intelligence_evidence');
    }

    if (!Number.isFinite(analysis.inci?.confidence) || analysis.inci.confidence <= 0) {
      blockers.push('missing_ingredient_confidence');
    }

    return blockers;
  }

  private toBlockedCandidate(
    product: ProductIntelligenceRequestProduct,
    upstreamError?: string,
  ): RecommendationCandidate {
    return {
      productId: product.productId,
      title: product.title,
      scores: {
        designation: 0,
        inciSuitability: 0,
        category: 0,
        tags: 0,
      },
      hardBlockers: ['missing_verified_product_intelligence'],
      personalizationScore: 0,
      evidence: {
        designationReasons: [],
        inciSignals: [],
        categoryReasons: [],
        tagReasons: [],
        limitations: [
          upstreamError || 'No verified product intelligence was returned.',
        ],
        confidence: 0,
        engineVersion: 'product-intelligence-adapter-v1',
      },
    };
  }

  private strings(values: unknown[]): string[] {
    return [...new Set((values || []).map(String).map((value) => value.trim()).filter(Boolean))];
  }

  private normalizeConfidence(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return this.clamp(value <= 1 ? value * 100 : value);
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }
}
