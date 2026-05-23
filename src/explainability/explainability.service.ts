import { Injectable } from '@nestjs/common';
import { BeautyDomain } from '../beauty-domain';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { CustomerFact } from '../tickets/customer-fact.entity';
import type {
  ConfidenceLevel,
  EvidenceSummary,
} from '../tickets/recommendation-evidence';

export type ExplanationSource =
  | 'customer_fact'
  | 'customer_profile'
  | 'product_tag'
  | 'product_analysis'
  | 'ingredient_intelligence'
  | 'recommendation_engine'
  | 'rule';

export type ExplanationReason = {
  code: string;
  label: string;
  detail: string;
  source: ExplanationSource;
  weight?: number;
};

export type ExplanationScoreImpact = {
  code: string;
  label: string;
  impact: number;
  direction: 'positive' | 'negative' | 'neutral';
  domain?: BeautyDomain;
};

export type ProductExplanation = {
  summary: string;
  reasons: ExplanationReason[];
  warnings: ExplanationReason[];
  scoreImpact: ExplanationScoreImpact[];
  confidence: number | null;
  confidenceLevel?: ConfidenceLevel;
  evidenceSummary?: {
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    missingEvidenceCount: number;
    conflictCount: number;
  };
};

export type ProductExplanationInput = {
  customerFacts?: CustomerFact[];
  productTags?: ProductTag[];
  productAnalysis?: ProductAnalysis;
  ingredientIntelligence?: IngredientIntelligenceResult;
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  evidence?: EvidenceSummary;
  scoreBreakdown?: {
    positives?: Array<{
      code: string;
      domain?: BeautyDomain;
      label: string;
      impact: number;
      source?: string;
    }>;
    negatives?: Array<{
      code: string;
      domain?: BeautyDomain;
      label: string;
      impact: number;
      source?: string;
    }>;
    blockers?: Array<{
      code: string;
      domain?: BeautyDomain;
      label: string;
      detail?: string;
      impact?: number;
      penalty?: number;
    }>;
  };
};

const WARNING_RULES: Record<
  string,
  { domain: BeautyDomain; label: string; detail: string; impact: number }
> = {
  contains_fragrance: {
    domain: 'skin',
    label: 'Contains fragrance',
    detail: 'Fragrance may irritate sensitive skin.',
    impact: -30,
  },
  contains_drying_alcohol: {
    domain: 'skin',
    label: 'Contains drying alcohol',
    detail: 'Drying alcohols may be unsuitable for dry or sensitive skin.',
    impact: -25,
  },
  comedogenic_risk: {
    domain: 'skin',
    label: 'Comedogenic risk',
    detail: 'Some ingredients may be pore-clogging for acne-prone skin.',
    impact: -30,
  },
  sensitive_skin_risk: {
    domain: 'skin',
    label: 'Sensitive skin risk',
    detail: 'This product has signals that may be risky for sensitive skin.',
    impact: -30,
  },
  contains_sulfates: {
    domain: 'hair',
    label: 'Contains sulfates',
    detail: 'Sulfates may be drying or unsuitable for some hair types.',
    impact: -20,
  },
  contains_heavy_silicones: {
    domain: 'hair',
    label: 'Contains heavy silicones',
    detail: 'Heavy silicones may weigh down fine hair or build up over time.',
    impact: -15,
  },
  color_stripping_risk: {
    domain: 'hair',
    label: 'Color-stripping risk',
    detail: 'This product may be unsuitable for color-treated hair.',
    impact: -30,
  },
  scalp_irritation_risk: {
    domain: 'hair',
    label: 'Scalp irritation risk',
    detail: 'This product has signals that may irritate sensitive scalps.',
    impact: -30,
  },
  protein_overload_risk: {
    domain: 'hair',
    label: 'Protein overload risk',
    detail:
      'Protein-rich signals may be unsuitable for protein-sensitive hair.',
    impact: -20,
  },
  projection_strong: {
    domain: 'fragrance',
    label: 'Strong projection',
    detail: 'Strong projection may be too intense for some settings.',
    impact: -20,
  },
  migraine_trigger_risk: {
    domain: 'fragrance',
    label: 'Migraine trigger risk',
    detail:
      'This fragrance has signals that may be problematic for migraine-sensitive customers.',
    impact: -20,
  },
  fragrance_allergen_risk: {
    domain: 'fragrance',
    label: 'Fragrance allergen risk',
    detail:
      'This product contains fragrance allergens or related risk signals.',
    impact: -20,
  },
  heavy_projection_risk: {
    domain: 'fragrance',
    label: 'Heavy projection risk',
    detail: 'This fragrance has signals that may project heavily.',
    impact: -20,
  },
  cloying_sweetness_risk: {
    domain: 'fragrance',
    label: 'Cloying sweetness risk',
    detail: 'Very sweet fragrance profiles may feel heavy or overwhelming.',
    impact: -15,
  },
};

const SCORE_REASON_RULES: Record<
  string,
  { label: string; detail: string; source: ExplanationSource }
> = {
  supports_dry_hair: {
    label: 'Supports dry hair',
    detail: 'This product has moisturizing signals for dry hair.',
    source: 'recommendation_engine',
  },
  supports_curly_hair: {
    label: 'Supports curly hair',
    detail: 'This product has curl-supporting signals.',
    source: 'recommendation_engine',
  },
  color_safe_support: {
    label: 'Color-safe support',
    detail: 'This product has signals suitable for color-treated hair.',
    source: 'recommendation_engine',
  },
  strengthening_hair_support: {
    label: 'Strengthening hair support',
    detail: 'This product has strengthening signals for damaged hair.',
    source: 'recommendation_engine',
  },
  volumizing_fine_hair: {
    label: 'Volumizing support',
    detail: 'This product has volume-supporting signals for fine hair.',
    source: 'recommendation_engine',
  },
  scalp_soothing_support: {
    label: 'Scalp soothing support',
    detail: 'This product has soothing signals for sensitive scalps.',
    source: 'recommendation_engine',
  },
  dry_hair_sulfate_free: {
    label: 'Sulfate-free for dry hair',
    detail: 'This product has sulfate-free signals for dry hair.',
    source: 'recommendation_engine',
  },
  curly_hair_sulfate_free: {
    label: 'Sulfate-free for curly hair',
    detail: 'This product has sulfate-free signals for curly hair.',
    source: 'recommendation_engine',
  },
  oily_scalp_sulfate_free: {
    label: 'Sulfate-free for oily scalp',
    detail: 'This product has sulfate-free signals for oily scalps.',
    source: 'recommendation_engine',
  },
  matches_floral: {
    label: 'Matches floral preference',
    detail: "This fragrance matches the customer's floral scent preference.",
    source: 'recommendation_engine',
  },
  matches_woody: {
    label: 'Matches woody preference',
    detail: "This fragrance matches the customer's woody scent preference.",
    source: 'recommendation_engine',
  },
  matches_citrus: {
    label: 'Matches citrus preference',
    detail: "This fragrance matches the customer's citrus scent preference.",
    source: 'recommendation_engine',
  },
  matches_amber: {
    label: 'Matches amber preference',
    detail: "This fragrance matches the customer's amber scent preference.",
    source: 'recommendation_engine',
  },
  matches_gourmand: {
    label: 'Matches gourmand preference',
    detail: "This fragrance matches the customer's gourmand scent preference.",
    source: 'recommendation_engine',
  },
  matches_fresh: {
    label: 'Matches fresh preference',
    detail: "This fragrance matches the customer's fresh scent preference.",
    source: 'recommendation_engine',
  },
  matches_musky: {
    label: 'Matches musky preference',
    detail: "This fragrance matches the customer's musky scent preference.",
    source: 'recommendation_engine',
  },
  matches_vanilla: {
    label: 'Matches vanilla preference',
    detail: "This fragrance matches the customer's vanilla scent preference.",
    source: 'recommendation_engine',
  },
  office_safe_projection: {
    label: 'Office-safe projection',
    detail:
      'Soft projection makes this fragrance more suitable for office settings.',
    source: 'recommendation_engine',
  },
  signature_scent_longevity: {
    label: 'Long-lasting signature scent',
    detail: 'High longevity supports use as a signature scent.',
    source: 'recommendation_engine',
  },
  date_night_evening_wear: {
    label: 'Date-night evening wear',
    detail: 'Evening-wear signals support date-night use.',
    source: 'recommendation_engine',
  },
  summer_citrus_support: {
    label: 'Summer citrus support',
    detail: 'Citrus signals support summer fragrance preferences.',
    source: 'recommendation_engine',
  },
  winter_amber_support: {
    label: 'Winter amber support',
    detail: 'Amber signals support winter fragrance preferences.',
    source: 'recommendation_engine',
  },
  winter_woody_support: {
    label: 'Winter woody support',
    detail: 'Woody signals support winter fragrance preferences.',
    source: 'recommendation_engine',
  },
  profile_match_dry_skin: {
    label: 'Matches your dry skin profile',
    detail: 'This product matches the dry skin signals in the beauty profile.',
    source: 'customer_profile',
  },
  profile_match_sensitive_skin: {
    label: 'Matches your sensitive skin profile',
    detail:
      'This product matches the sensitive skin signals in the beauty profile.',
    source: 'customer_profile',
  },
  profile_match_dry_hair: {
    label: 'Matches your hair care profile',
    detail: 'This product matches the dry hair signals in the beauty profile.',
    source: 'customer_profile',
  },
  profile_match_sulfate_free: {
    label: 'Matches your sulfate-free profile',
    detail:
      'This product matches the sulfate-free preference in the beauty profile.',
    source: 'customer_profile',
  },
  profile_match_floral: {
    label: 'Matches your fragrance profile',
    detail: 'This product matches the floral signals in the beauty profile.',
    source: 'customer_profile',
  },
  profile_match_office_safe_projection: {
    label: 'Matches your office fragrance profile',
    detail:
      'Soft projection matches the office-safe signal in the beauty profile.',
    source: 'customer_profile',
  },
  profile_risk_sensitive_skin_fragrance: {
    label: 'Conflicts with your sensitive skin profile',
    detail:
      'This product has fragrance risk signals for the sensitive skin profile.',
    source: 'customer_profile',
  },
  profile_risk_sensitive_skin: {
    label: 'Conflicts with your sensitive skin profile',
    detail:
      'This product has sensitive skin risk signals for the beauty profile.',
    source: 'customer_profile',
  },
  profile_risk_acne_prone: {
    label: 'Conflicts with your acne-prone profile',
    detail: 'This product has comedogenic risk signals for the beauty profile.',
    source: 'customer_profile',
  },
  profile_risk_dry_hair_sulfates: {
    label: 'Conflicts with your hair care profile',
    detail: 'This product contains sulfates for a dry hair profile.',
    source: 'customer_profile',
  },
  profile_risk_sensitive_scalp: {
    label: 'Conflicts with your scalp profile',
    detail:
      'This product has scalp irritation risk signals for the beauty profile.',
    source: 'customer_profile',
  },
  profile_risk_migraine_heavy_projection: {
    label: 'Conflicts with your fragrance sensitivity profile',
    detail:
      'This product has heavy projection risk for the fragrance sensitivity profile.',
    source: 'customer_profile',
  },
  profile_risk_fragrance_allergen: {
    label: 'Conflicts with your fragrance sensitivity profile',
    detail: 'This product has fragrance allergen risk for the beauty profile.',
    source: 'customer_profile',
  },
};

@Injectable()
export class ExplainabilityService {
  generateProductExplanation(
    input: ProductExplanationInput,
  ): ProductExplanation {
    const reasons: ExplanationReason[] = [];
    const warnings: ExplanationReason[] = [];
    const scoreImpact = this.buildScoreImpacts(input.scoreBreakdown);
    const ingredientIntelligence =
      input.ingredientIntelligence ??
      this.getIngredientIntelligence(input.productAnalysis);
    const factValues = new Set(
      (input.customerFacts || [])
        .flatMap((fact) => [fact.type, fact.value])
        .map((value) => this.normalizeCode(value))
        .filter(Boolean),
    );
    const productTagConcepts = this.getProductTagConcepts(input.productTags);
    const analysisConcepts = this.getAnalysisConcepts(input.productAnalysis);
    const productConcepts = new Set([
      ...productTagConcepts.keys(),
      ...analysisConcepts,
    ]);

    if (factValues.has('dry_skin') && productConcepts.has('dry_skin')) {
      const source = productTagConcepts.has('dry_skin')
        ? 'product_tag'
        : 'product_analysis';

      this.addReason(reasons, {
        code: 'matches_dry_skin',
        label: 'Matches dry skin',
        detail: "This product matches the customer's dry skin needs.",
        source,
        weight: 25,
      });
      this.addImpact(scoreImpact, {
        code: 'matches_dry_skin',
        domain: 'skin',
        label: 'Matches dry skin',
        impact: 25,
        direction: 'positive',
      });
    }

    if (
      factValues.has('sensitive_skin') &&
      productConcepts.has('sensitive_skin')
    ) {
      const source = productTagConcepts.has('sensitive_skin')
        ? 'product_tag'
        : 'product_analysis';

      this.addReason(reasons, {
        code: 'matches_sensitive_skin',
        label: 'Matches sensitive skin',
        detail: 'This product appears compatible with sensitive skin.',
        source,
        weight: 25,
      });
      this.addImpact(scoreImpact, {
        code: 'matches_sensitive_skin',
        domain: 'skin',
        label: 'Matches sensitive skin',
        impact: 25,
        direction: 'positive',
      });
    }

    if (ingredientIntelligence?.benefits.includes('hydration')) {
      const impact = ingredientIntelligence.scores.hydrationBoost;

      this.addReason(reasons, {
        code: 'hydration_support',
        label: 'Hydration support',
        detail: 'Contains ingredients associated with hydration support.',
        source: 'ingredient_intelligence',
        weight: impact,
      });
      this.addImpact(scoreImpact, {
        code: 'hydration_support',
        domain: 'skin',
        label: 'Hydration support',
        impact,
        direction: impact > 0 ? 'positive' : 'neutral',
      });
    }

    if (ingredientIntelligence?.benefits.includes('barrier_support')) {
      const impact = ingredientIntelligence.scores.barrierSupportBoost;

      this.addReason(reasons, {
        code: 'barrier_support',
        label: 'Barrier support',
        detail: 'Contains ingredients associated with skin barrier support.',
        source: 'ingredient_intelligence',
        weight: impact,
      });
      this.addImpact(scoreImpact, {
        code: 'barrier_support',
        domain: 'skin',
        label: 'Barrier support',
        impact,
        direction: impact > 0 ? 'positive' : 'neutral',
      });
    }

    for (const item of input.scoreBreakdown?.positives || []) {
      const rule = SCORE_REASON_RULES[item.code];
      if (!rule) continue;

      this.addReason(reasons, {
        code: item.code,
        label: rule.label,
        detail: rule.detail,
        source: rule.source,
        weight: item.impact,
      });
    }

    for (const item of input.scoreBreakdown?.negatives || []) {
      const rule = SCORE_REASON_RULES[item.code];
      if (!rule) continue;

      this.addReason(warnings, {
        code: item.code,
        label: rule.label,
        detail: rule.detail,
        source: rule.source,
        weight: item.impact,
      });
    }

    for (const warning of this.getWarningConcepts(
      input.productAnalysis,
      ingredientIntelligence,
    )) {
      const rule = WARNING_RULES[warning];
      if (!rule) continue;

      const ingredientWarnings = new Set([
        ...(ingredientIntelligence?.risks || []),
        ...(ingredientIntelligence?.warnings || []),
      ]);
      const source = ingredientWarnings.has(warning)
        ? 'ingredient_intelligence'
        : 'product_analysis';

      this.addReason(warnings, {
        code: warning,
        label: rule.label,
        detail: rule.detail,
        source,
        weight: rule.impact,
      });
      this.addImpact(scoreImpact, {
        code: warning,
        domain: rule.domain,
        label: rule.label,
        impact: rule.impact,
        direction: 'negative',
      });
    }

    for (const blocker of input.scoreBreakdown?.blockers || []) {
      this.addReason(warnings, {
        code: blocker.code,
        label: blocker.label,
        detail:
          blocker.detail ||
          'This product has strong customer-specific risk signals.',
        source: 'rule',
        weight: blocker.penalty ?? blocker.impact,
      });
    }

    return {
      summary: this.buildSummary(
        reasons,
        warnings,
        Boolean(input.scoreBreakdown?.blockers?.length),
      ),
      reasons,
      warnings,
      scoreImpact,
      confidence:
        typeof input.confidence === 'number'
          ? input.confidence
          : typeof input.productAnalysis?.confidence === 'number'
            ? input.productAnalysis.confidence
            : null,
      confidenceLevel: input.confidenceLevel,
      evidenceSummary: input.evidence
        ? {
            positiveCount: input.evidence.positiveEvidence.length,
            negativeCount: input.evidence.negativeEvidence.length,
            neutralCount: input.evidence.neutralEvidence.length,
            missingEvidenceCount: input.evidence.missingEvidence.length,
            conflictCount: input.evidence.conflicts.length,
          }
        : undefined,
    };
  }

  private getProductTagConcepts(productTags: ProductTag[] | undefined) {
    const concepts = new Map<string, ProductTag>();

    for (const tag of productTags || []) {
      for (const value of [tag.normalizedKey, tag.name]) {
        const concept = this.normalizeCode(value);
        if (concept) concepts.set(concept, tag);
      }
    }

    return concepts;
  }

  private getAnalysisConcepts(productAnalysis: ProductAnalysis | undefined) {
    const concepts = new Set<string>();

    if (!productAnalysis) return concepts;

    for (const value of [
      productAnalysis.warnings,
      productAnalysis.matchedConcepts,
      productAnalysis.suitableFor,
      productAnalysis.notSuitableFor,
      productAnalysis.rawAnalysis?.warnings,
      productAnalysis.rawAnalysis?.matchedConcepts,
      productAnalysis.rawAnalysis?.suitableFor,
      productAnalysis.rawAnalysis?.notSuitableFor,
    ]) {
      for (const concept of this.getConceptsFromValue(value)) {
        concepts.add(concept);
      }
    }

    const fragranceProfile = productAnalysis.rawAnalysis?.fragranceProfile;
    if (fragranceProfile && typeof fragranceProfile === 'object') {
      const profile = fragranceProfile as Record<string, unknown>;

      for (const value of [
        profile.families,
        profile.performance,
        profile.context,
        profile.risks,
      ]) {
        for (const concept of this.getConceptsFromValue(value)) {
          concepts.add(concept);
        }
      }
    }

    return concepts;
  }

  private getWarningConcepts(
    productAnalysis: ProductAnalysis | undefined,
    ingredientIntelligence: IngredientIntelligenceResult | undefined,
  ) {
    const warnings = new Set<string>();

    for (const value of [
      productAnalysis?.warnings,
      productAnalysis?.rawAnalysis?.warnings,
      this.getFragranceProfileRisks(productAnalysis),
      ingredientIntelligence?.risks,
      ingredientIntelligence?.warnings,
    ]) {
      for (const warning of this.getConceptsFromValue(value)) {
        warnings.add(warning);
      }
    }

    return Array.from(warnings).sort();
  }

  private getFragranceProfileRisks(
    productAnalysis: ProductAnalysis | undefined,
  ) {
    const fragranceProfile = productAnalysis?.rawAnalysis?.fragranceProfile;
    if (!fragranceProfile || typeof fragranceProfile !== 'object') return [];

    return (fragranceProfile as Record<string, unknown>).risks;
  }

  private getIngredientIntelligence(
    productAnalysis: ProductAnalysis | undefined,
  ): IngredientIntelligenceResult | undefined {
    const rawValue = productAnalysis?.rawAnalysis?.ingredientIntelligence;

    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return undefined;
    }

    return rawValue as IngredientIntelligenceResult;
  }

  private getConceptsFromValue(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>;
          return [record.code, record.key, record.normalizedKey, record.value];
        }
        return [];
      })
      .map((item) => this.normalizeCode(item))
      .filter((item): item is string => Boolean(item));
  }

  private buildSummary(
    reasons: ExplanationReason[],
    warnings: ExplanationReason[],
    hasBlockers = false,
  ) {
    if (hasBlockers) {
      return 'Not recommended due to strong risk signals for this customer.';
    }

    if (reasons.length && !warnings.length) {
      return 'Strong match based on skin needs and ingredient profile.';
    }

    if (reasons.length && warnings.length) {
      return 'Potential match, but review warnings before recommending.';
    }

    if (!reasons.length && warnings.length) {
      return 'Use caution due to product risk signals.';
    }

    return 'Limited explanation available for this product.';
  }

  private addReason(reasons: ExplanationReason[], reason: ExplanationReason) {
    if (reasons.some((existing) => existing.code === reason.code)) return;

    reasons.push(reason);
  }

  private addImpact(
    impacts: ExplanationScoreImpact[],
    impact: ExplanationScoreImpact,
  ) {
    if (impacts.some((existing) => existing.code === impact.code)) return;

    impacts.push(impact);
  }

  private buildScoreImpacts(
    scoreBreakdown: ProductExplanationInput['scoreBreakdown'],
  ) {
    const impacts: ExplanationScoreImpact[] = [];

    for (const item of scoreBreakdown?.positives || []) {
      this.addImpact(impacts, {
        code: item.code,
        domain: item.domain,
        label: item.label,
        impact: item.impact,
        direction: this.getImpactDirection(item.impact),
      });
    }

    for (const item of scoreBreakdown?.negatives || []) {
      this.addImpact(impacts, {
        code: item.code,
        domain: item.domain,
        label: item.label,
        impact: item.impact,
        direction: this.getImpactDirection(item.impact),
      });
    }

    for (const item of scoreBreakdown?.blockers || []) {
      const impact = item.impact ?? item.penalty ?? 0;

      this.addImpact(impacts, {
        code: item.code,
        domain: item.domain,
        label: item.label,
        impact,
        direction: this.getImpactDirection(impact),
      });
    }

    return impacts;
  }

  private getImpactDirection(
    impact: number,
  ): ExplanationScoreImpact['direction'] {
    if (impact > 0) return 'positive';
    if (impact < 0) return 'negative';
    return 'neutral';
  }

  private normalizeCode(value: unknown) {
    if (typeof value !== 'string') return null;

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalized || null;
  }
}
