import { Injectable } from '@nestjs/common';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { CustomerFact } from '../intelligence/customer-fact.entity';

export type ExplanationSource =
  | 'customer_fact'
  | 'product_tag'
  | 'product_analysis'
  | 'ingredient_intelligence'
  | 'rule';

export type ExplanationReason = {
  code: string;
  label: string;
  detail: string;
  source: ExplanationSource;
  weight?: number;
};

export type ProductExplanation = {
  summary: string;
  reasons: ExplanationReason[];
  warnings: ExplanationReason[];
  confidence: number | null;
};

export type ProductExplanationInput = {
  customerFacts?: CustomerFact[];
  productTags?: ProductTag[];
  productAnalysis?: ProductAnalysis;
  ingredientIntelligence?: IngredientIntelligenceResult;
};

const WARNING_LABELS: Record<string, { label: string; detail: string; weight: number }> = {
  contains_fragrance: {
    label: 'Contains fragrance',
    detail: 'Fragrance may irritate sensitive skin or fragrance-sensitive customers.',
    weight: -30,
  },
  contains_drying_alcohol: {
    label: 'Contains drying alcohol',
    detail: 'Drying alcohol may be unsuitable for dry or sensitive skin.',
    weight: -25,
  },
  comedogenic_risk: {
    label: 'Comedogenic risk',
    detail: 'Some ingredients may be pore-clogging for acne-prone skin.',
    weight: -30,
  },
  sensitive_skin_risk: {
    label: 'Sensitive skin risk',
    detail: 'This product has signals that may be risky for sensitive skin.',
    weight: -30,
  },
  contains_sulfates: {
    label: 'Contains sulfates',
    detail: 'Sulfates may be drying or unsuitable for some hair and scalp needs.',
    weight: -20,
  },
  scalp_irritation_risk: {
    label: 'Scalp irritation risk',
    detail: 'This product has signals that may irritate sensitive scalps.',
    weight: -25,
  },
  fragrance_allergen_risk: {
    label: 'Fragrance allergen risk',
    detail: 'This product contains fragrance allergen signals.',
    weight: -20,
  },
};

@Injectable()
export class ExplainabilityService {
  generateProductExplanation(input: ProductExplanationInput): ProductExplanation {
    const reasons: ExplanationReason[] = [];
    const warnings: ExplanationReason[] = [];
    const ingredientIntelligence =
      input.ingredientIntelligence ?? this.getIngredientIntelligence(input.productAnalysis);
    const productConcepts = new Set([
      ...this.getProductTagConcepts(input.productTags),
      ...this.getAnalysisConcepts(input.productAnalysis),
    ]);
    const customerConcepts = new Set(
      (input.customerFacts || [])
        .flatMap((fact) => [fact.type, fact.value])
        .map((value) => this.normalizeCode(value))
        .filter((value): value is string => Boolean(value)),
    );

    if (customerConcepts.has('dry_skin') && productConcepts.has('hydration')) {
      this.addReason(reasons, {
        code: 'supports_dry_skin',
        label: 'Supports dry skin',
        detail: 'Ingredient and product signals indicate hydration support.',
        source: 'ingredient_intelligence',
        weight: 25,
      });
    }

    if (
      customerConcepts.has('sensitive_skin') &&
      productConcepts.has('barrier_support') &&
      !productConcepts.has('sensitive_skin_risk')
    ) {
      this.addReason(reasons, {
        code: 'supports_sensitive_skin',
        label: 'Supports sensitive skin',
        detail: 'The product has barrier support signals and no strong sensitive-skin warning.',
        source: 'ingredient_intelligence',
        weight: 20,
      });
    }

    if (ingredientIntelligence?.benefits.includes('hydration')) {
      this.addReason(reasons, {
        code: 'hydration_support',
        label: 'Hydration support',
        detail: 'Contains ingredients associated with hydration support.',
        source: 'ingredient_intelligence',
        weight: ingredientIntelligence.scores.hydrationBoost,
      });
    }

    if (ingredientIntelligence?.benefits.includes('barrier_support')) {
      this.addReason(reasons, {
        code: 'barrier_support',
        label: 'Barrier support',
        detail: 'Contains ingredients associated with skin barrier support.',
        source: 'ingredient_intelligence',
        weight: ingredientIntelligence.scores.barrierSupportBoost,
      });
    }

    for (const warning of this.getWarningConcepts(input.productAnalysis, ingredientIntelligence)) {
      const rule = WARNING_LABELS[warning];
      if (!rule) continue;
      this.addReason(warnings, {
        code: warning,
        label: rule.label,
        detail: rule.detail,
        source: ingredientIntelligence?.warnings.includes(warning)
          ? 'ingredient_intelligence'
          : 'product_analysis',
        weight: rule.weight,
      });
    }

    return {
      summary: this.buildSummary(reasons, warnings),
      reasons,
      warnings,
      confidence:
        typeof input.productAnalysis?.confidence === 'number'
          ? input.productAnalysis.confidence
          : null,
    };
  }

  private getProductTagConcepts(productTags: ProductTag[] | undefined) {
    return (productTags || [])
      .flatMap((tag) => [tag.normalizedKey, tag.name])
      .map((value) => this.normalizeCode(value))
      .filter((value): value is string => Boolean(value));
  }

  private getAnalysisConcepts(productAnalysis: ProductAnalysis | undefined) {
    if (!productAnalysis) return [];
    return [
      productAnalysis.warnings,
      productAnalysis.matchedConcepts,
      productAnalysis.suitableFor,
      productAnalysis.notSuitableFor,
      productAnalysis.rawAnalysis?.warnings,
      productAnalysis.rawAnalysis?.matchedConcepts,
    ]
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .map((value) => this.normalizeCode(value))
      .filter((value): value is string => Boolean(value));
  }

  private getWarningConcepts(
    productAnalysis: ProductAnalysis | undefined,
    ingredientIntelligence: IngredientIntelligenceResult | undefined,
  ) {
    return Array.from(
      new Set(
        [
          productAnalysis?.warnings,
          productAnalysis?.rawAnalysis?.warnings,
          ingredientIntelligence?.risks,
          ingredientIntelligence?.warnings,
        ]
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .map((value) => this.normalizeCode(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }

  private getIngredientIntelligence(
    productAnalysis: ProductAnalysis | undefined,
  ): IngredientIntelligenceResult | undefined {
    const rawValue = productAnalysis?.rawAnalysis?.ingredientIntelligence;
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return undefined;
    return rawValue as IngredientIntelligenceResult;
  }

  private buildSummary(reasons: ExplanationReason[], warnings: ExplanationReason[]) {
    if (reasons.length && !warnings.length) {
      return 'Strong product match based on ingredient and product signals.';
    }
    if (reasons.length && warnings.length) {
      return 'Potential product match, but review warnings before recommending.';
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
