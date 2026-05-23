import { Repository } from 'typeorm';
import { ExplainabilityService } from '../explainability/explainability.service';
import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { Product } from '../products/product.entity';
import { CustomerFact } from './customer-fact.entity';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { Customer } from './customer.entity';
import { CustomerEvent } from './customer-event.entity';
import { Message } from './message.entity';
import { getFactDomain, getProductTagDomain } from './recommendation-scoring';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';

function repo<T>(
  overrides: Partial<Record<keyof Repository<T>, unknown>> = {},
) {
  return overrides as unknown as Repository<T>;
}

function fact(value: string, overrides: Partial<CustomerFact> = {}) {
  return {
    id: Math.random(),
    type: 'skin_need',
    value,
    confidence: 0.8,
    ...overrides,
  } as CustomerFact;
}

function tag(normalizedKey: string) {
  return {
    id: Math.random(),
    name: normalizedKey,
    normalizedKey,
  } as ProductTag;
}

function ingredientIntelligence(
  overrides: Partial<IngredientIntelligenceResult> = {},
): IngredientIntelligenceResult {
  return {
    detectedIngredients: [],
    knownIngredients: [],
    unknownIngredients: [],
    benefits: [],
    risks: [],
    warnings: [],
    scores: {
      hydrationBoost: 0,
      barrierSupportBoost: 0,
      irritationPenalty: 0,
      acneRiskPenalty: 0,
    },
    ...overrides,
    scores: {
      hydrationBoost: 0,
      barrierSupportBoost: 0,
      irritationPenalty: 0,
      acneRiskPenalty: 0,
      ...overrides.scores,
    },
  };
}

function analysis({
  warnings = [],
  matchedConcepts = [],
  ingredient = ingredientIntelligence(),
  rawAnalysis = {},
  confidence = 0.86,
}: {
  warnings?: string[];
  matchedConcepts?: string[];
  ingredient?: IngredientIntelligenceResult;
  rawAnalysis?: Record<string, unknown>;
  confidence?: number;
} = {}) {
  return {
    id: Math.random(),
    status: 'completed',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    confidence,
    warnings,
    matchedConcepts,
    scores: {
      hydrationScore: 90,
      acneSafetyScore: 80,
      sensitiveSafetyScore: 70,
    },
    rawAnalysis: {
      ...rawAnalysis,
      ingredientIntelligence: ingredient,
    },
  } as ProductAnalysis;
}

function product({
  id,
  name,
  tags = [],
  productAnalysis = analysis(),
  analyses,
}: {
  id: number;
  name: string;
  tags?: ProductTag[];
  productAnalysis?: ProductAnalysis | null;
  analyses?: ProductAnalysis[];
}) {
  return {
    id,
    name,
    quantity: 3,
    isActive: true,
    isDiscontinued: false,
    tags,
    analyses: analyses ?? (productAnalysis ? [productAnalysis] : []),
  } as Product;
}

function createService(facts: CustomerFact[], products: Product[]) {
  return new TicketsService(
    repo<Ticket>(),
    repo<Message>(),
    repo<Customer>({
      findOne: jest.fn(async () => ({ id: 1 }) as Customer),
    }),
    repo<CustomerFact>({
      find: jest.fn(async () => facts),
    }),
    repo<CustomerEvent>({
      find: jest.fn(async () => []),
    }),
    repo({
      find: jest.fn(async () => []),
    }),
    repo<Product>({
      find: jest.fn(async () => products),
    }),
    {} as CustomerIntelligenceService,
    new ExplainabilityService(),
  );
}

describe('TicketsService recommendations', () => {
  it('adds a positive v5 score for a dry skin match', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Dry Skin Cream',
          tags: [tag('dry_skin')],
          productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.recommendationScoreV5).toBeGreaterThanOrEqual(25);
    expect(recommendation.domains).toEqual(['skin']);
    expect(recommendation.confidenceLevel).toBe('high');
    expect(recommendation.explanation.confidence).toBe(
      recommendation.confidence,
    );
    expect(recommendation.scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_dry_skin',
          domain: 'skin',
          impact: 25,
        }),
        expect.objectContaining({
          code: 'profile_match_dry_skin',
          domain: 'skin',
          impact: 12,
          source: 'customer_profile',
          confidence: 0.8,
        }),
      ]),
    );
    expect(recommendation.profileAlignment).toEqual(
      expect.objectContaining({
        matchedSignals: expect.arrayContaining([
          expect.objectContaining({
            key: 'dry_skin',
            domain: 'skin',
            confidence: 0.8,
            impact: 12,
          }),
        ]),
      }),
    );
    expect(recommendation.evidence.positiveEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_dry_skin',
          source: 'product_tag',
          domain: 'skin',
          polarity: 'positive',
        }),
        expect.objectContaining({
          code: 'profile_match_dry_skin',
          source: 'customer_profile',
          domain: 'skin',
          polarity: 'positive',
        }),
      ]),
    );
    expect(recommendation.explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile_match_dry_skin',
          source: 'customer_profile',
        }),
      ]),
    );
  });

  it('adds a hydration support boost', async () => {
    const service = createService(
      [],
      [
        product({
          id: 1,
          name: 'Hydrating Serum',
          productAnalysis: analysis({
            ingredient: ingredientIntelligence({
              benefits: ['hydration'],
              scores: { hydrationBoost: 20 },
            }),
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'hydration_support',
          domain: 'skin',
          impact: 20,
        }),
      ]),
    );
  });

  it('scales profile-aware boosts by profile signal confidence', async () => {
    const lowConfidenceService = createService(
      [fact('dry_skin', { confidence: 0.4 })],
      [
        product({
          id: 1,
          name: 'Low Confidence Dry Skin Cream',
          tags: [tag('dry_skin')],
          productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
        }),
      ],
    );
    const highConfidenceService = createService(
      [fact('dry_skin', { confidence: 0.8 })],
      [
        product({
          id: 1,
          name: 'High Confidence Dry Skin Cream',
          tags: [tag('dry_skin')],
          productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
        }),
      ],
    );

    const lowResult = await lowConfidenceService.getCustomerRecommendations(1);
    const highResult =
      await highConfidenceService.getCustomerRecommendations(1);
    const lowImpact =
      lowResult.recommendations[0].scoreBreakdown.positives.find(
        (item) => item.code === 'profile_match_dry_skin',
      )?.impact;
    const highImpact =
      highResult.recommendations[0].scoreBreakdown.positives.find(
        (item) => item.code === 'profile_match_dry_skin',
      )?.impact;

    expect(lowImpact).toBe(5);
    expect(highImpact).toBe(12);
  });

  it('adds a positive hair score for dry hair moisturizing support', async () => {
    const service = createService(
      [fact('dry_hair')],
      [
        product({
          id: 1,
          name: 'Moisturizing Hair Mask',
          productAnalysis: analysis({
            ingredient: ingredientIntelligence({
              benefits: ['moisturizing_hair'],
            }),
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.recommendationScoreV5).toBeGreaterThanOrEqual(25);
    expect(recommendation.domains).toEqual(['hair']);
    expect(recommendation.scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'supports_dry_hair',
          domain: 'hair',
          impact: 25,
          source: 'ingredient_intelligence',
        }),
        expect.objectContaining({
          code: 'profile_match_dry_hair',
          domain: 'hair',
          impact: 12,
          source: 'customer_profile',
        }),
      ]),
    );
    expect(recommendation.profileAlignment).toEqual(
      expect.objectContaining({
        matchedSignals: expect.arrayContaining([
          expect.objectContaining({
            key: 'dry_hair',
            domain: 'hair',
            impact: 12,
          }),
        ]),
      }),
    );
    expect(recommendation.evidence.positiveEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile_match_dry_hair',
          source: 'customer_profile',
          domain: 'hair',
        }),
      ]),
    );
    expect(recommendation.explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'supports_dry_hair' }),
        expect.objectContaining({ code: 'profile_match_dry_hair' }),
      ]),
    );
  });

  it('adds a positive hair score for curly hair curl support', async () => {
    const service = createService(
      [fact('curly_hair')],
      [
        product({
          id: 1,
          name: 'Curl Cream',
          tags: [tag('curl_defining')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'supports_curly_hair',
          domain: 'hair',
          impact: 25,
        }),
      ]),
    );
  });

  it('adds a positive hair score for color-treated hair color safety', async () => {
    const service = createService(
      [fact('color_treated_hair')],
      [
        product({
          id: 1,
          name: 'Color Safe Shampoo',
          tags: [tag('color_safe')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'color_safe_support',
          domain: 'hair',
          impact: 30,
        }),
      ]),
    );
  });

  it('adds a positive fragrance score for a floral match', async () => {
    const service = createService(
      [fact('floral')],
      [
        product({
          id: 1,
          name: 'Floral Eau de Parfum',
          tags: [tag('floral')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.recommendationScoreV5).toBeGreaterThanOrEqual(25);
    expect(recommendation.domains).toEqual(['fragrance']);
    expect(recommendation.scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_floral',
          domain: 'fragrance',
          impact: 25,
        }),
        expect.objectContaining({
          code: 'profile_match_floral',
          domain: 'fragrance',
          impact: 12,
          source: 'customer_profile',
        }),
      ]),
    );
    expect(recommendation.profileAlignment.matchedSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'floral',
          domain: 'fragrance',
          impact: 12,
        }),
      ]),
    );
    expect(recommendation.explanation.scoreImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_floral',
          domain: 'fragrance',
          direction: 'positive',
        }),
        expect.objectContaining({
          code: 'profile_match_floral',
          domain: 'fragrance',
          direction: 'positive',
        }),
      ]),
    );
  });

  it('adds a positive fragrance score for a woody match', async () => {
    const service = createService(
      [fact('woody')],
      [
        product({
          id: 1,
          name: 'Woody Eau de Parfum',
          tags: [tag('woody')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_woody',
          domain: 'fragrance',
          impact: 25,
        }),
      ]),
    );
  });

  it('adds office-safe projection support for soft projection', async () => {
    const service = createService(
      [fact('office_safe')],
      [
        product({
          id: 1,
          name: 'Soft Office Fragrance',
          tags: [tag('projection_soft')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'office_safe_projection',
          domain: 'fragrance',
          impact: 20,
        }),
      ]),
    );
  });

  it('adds signature scent support for high longevity', async () => {
    const service = createService(
      [fact('signature_scent')],
      [
        product({
          id: 1,
          name: 'Long Lasting Fragrance',
          tags: [tag('longevity_high')],
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'signature_scent_longevity',
          domain: 'fragrance',
          impact: 20,
        }),
      ]),
    );
  });

  it('uses raw fragrance profile families for fragrance scoring', async () => {
    const service = createService(
      [fact('floral')],
      [
        product({
          id: 1,
          name: 'Profiled Floral Fragrance',
          productAnalysis: analysis({
            rawAnalysis: {
              fragranceProfile: {
                families: ['Floral'],
                performance: [],
                context: [],
                risks: [],
              },
            },
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].scoreBreakdown.positives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_floral',
          source: 'product_analysis',
          domain: 'fragrance',
        }),
      ]),
    );
  });

  it('blocks fragrance for sensitive skin', async () => {
    const service = createService(
      [fact('sensitive_skin')],
      [
        product({
          id: 1,
          name: 'Fragranced Cream',
          productAnalysis: analysis({ warnings: ['contains_fragrance'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.blocked).toBe(true);
    expect(recommendation.evidence.negativeEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'contains_fragrance',
          source: 'product_analysis',
          domain: 'skin',
          polarity: 'negative',
        }),
        expect.objectContaining({
          code: 'fragrance_sensitive_skin_blocker',
          source: 'rule',
          domain: 'skin',
          polarity: 'negative',
        }),
        expect.objectContaining({
          code: 'profile_risk_sensitive_skin_fragrance',
          source: 'customer_profile',
          domain: 'skin',
          polarity: 'negative',
          impact: -16,
        }),
      ]),
    );
    expect(recommendation.profileAlignment.riskSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'sensitive_skin',
          domain: 'skin',
          impact: -16,
        }),
      ]),
    );
    expect(recommendation.scoreBreakdown.negatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile_risk_sensitive_skin_fragrance',
          source: 'customer_profile',
          domain: 'skin',
          impact: -16,
        }),
      ]),
    );
    expect(recommendation.explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile_risk_sensitive_skin_fragrance',
          source: 'customer_profile',
        }),
      ]),
    );
    expect(recommendation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'fragrance_sensitive_skin_blocker',
          domain: 'skin',
          penalty: -60,
        }),
      ]),
    );
  });

  it('blocks sensitive skin risk for sensitive skin', async () => {
    const service = createService(
      [fact('sensitive_skin')],
      [
        product({
          id: 1,
          name: 'Risky Cream',
          productAnalysis: analysis({ warnings: ['sensitive_skin_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].confidenceLevel).toBe('low');
    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'sensitive_skin_risk_blocker' }),
      ]),
    );
  });

  it('blocks comedogenic risk for acne-prone skin', async () => {
    const service = createService(
      [fact('acne_prone')],
      [
        product({
          id: 1,
          name: 'Comedogenic Oil',
          productAnalysis: analysis({ warnings: ['comedogenic_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'comedogenic_acne_blocker' }),
      ]),
    );
  });

  it('blocks drying alcohol for dry skin', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Alcohol Toner',
          productAnalysis: analysis({ warnings: ['contains_drying_alcohol'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'drying_alcohol_dry_skin_blocker' }),
      ]),
    );
  });

  it('blocks sulfates for dry hair', async () => {
    const service = createService(
      [fact('dry_hair')],
      [
        product({
          id: 1,
          name: 'Sulfate Shampoo',
          productAnalysis: analysis({ warnings: ['contains_sulfates'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blocked).toBe(true);
    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'sulfate_dry_hair_blocker',
          domain: 'hair',
          penalty: -60,
        }),
      ]),
    );
  });

  it('blocks sulfates for curly hair', async () => {
    const service = createService(
      [fact('curly_hair')],
      [
        product({
          id: 1,
          name: 'Clarifying Shampoo',
          productAnalysis: analysis({ warnings: ['contains_sulfates'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'sulfate_curly_hair_blocker',
          domain: 'hair',
          penalty: -55,
        }),
      ]),
    );
  });

  it('blocks color-stripping risk for color-treated hair', async () => {
    const service = createService(
      [fact('color_treated_hair')],
      [
        product({
          id: 1,
          name: 'Stripping Shampoo',
          productAnalysis: analysis({ warnings: ['color_stripping_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'color_stripping_blocker',
          domain: 'hair',
          penalty: -70,
        }),
      ]),
    );
  });

  it('blocks scalp irritation risk for sensitive scalps', async () => {
    const service = createService(
      [fact('sensitive_scalp')],
      [
        product({
          id: 1,
          name: 'Irritating Scalp Serum',
          productAnalysis: analysis({ warnings: ['scalp_irritation_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'scalp_irritation_blocker',
          domain: 'hair',
          penalty: -65,
        }),
      ]),
    );
  });

  it('adds a negative score and blocker for office-safe strong projection', async () => {
    const service = createService(
      [fact('office_safe')],
      [
        product({
          id: 1,
          name: 'Room Filling Fragrance',
          productAnalysis: analysis({ warnings: ['projection_strong'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.blocked).toBe(true);
    expect(recommendation.confidenceLevel).toBe('low');
    expect(recommendation.evidence.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'office_safe_but_strong_projection',
          domain: 'fragrance',
        }),
      ]),
    );
    expect(recommendation.scoreBreakdown.negatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'office_projection_strong',
          domain: 'fragrance',
          impact: -35,
        }),
      ]),
    );
    expect(recommendation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'office_projection_blocker',
          domain: 'fragrance',
          penalty: -55,
        }),
      ]),
    );
  });

  it('blocks heavy projection for migraine-sensitive fragrance customers', async () => {
    const service = createService(
      [fact('migraine_trigger_risk')],
      [
        product({
          id: 1,
          name: 'Heavy Projection Fragrance',
          productAnalysis: analysis({ warnings: ['heavy_projection_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.scoreBreakdown.negatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'profile_risk_migraine_heavy_projection',
          source: 'customer_profile',
          domain: 'fragrance',
          impact: -20,
        }),
      ]),
    );
    expect(recommendation.profileAlignment.riskSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'migraine_trigger_risk',
          domain: 'fragrance',
          impact: -20,
        }),
      ]),
    );
    expect(recommendation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'migraine_heavy_projection_blocker',
          domain: 'fragrance',
          penalty: -70,
        }),
      ]),
    );
  });

  it('blocks fragrance allergens for allergen-risk customers', async () => {
    const service = createService(
      [fact('fragrance_allergen_risk')],
      [
        product({
          id: 1,
          name: 'Allergen Risk Fragrance',
          productAnalysis: analysis({ warnings: ['fragrance_allergen_risk'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'fragrance_allergen_blocker',
          domain: 'fragrance',
          penalty: -65,
        }),
      ]),
    );
  });

  it('adds missing product analysis evidence and lowers confidence', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Tagged Cream Without Analysis',
          tags: [tag('dry_skin')],
          productAnalysis: null,
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(recommendation.evidence.missingEvidence).toContain(
      'missing_product_analysis',
    );
    expect(recommendation.confidence).toBeLessThan(0.75);
  });

  it('adds low analysis confidence to missing evidence', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Low Confidence Cream',
          tags: [tag('dry_skin')],
          productAnalysis: analysis({
            matchedConcepts: ['dry_skin'],
            confidence: 0.25,
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].evidence.missingEvidence).toContain(
      'low_analysis_confidence',
    );
  });

  it('detects sensitive skin match conflict when analysis is risky', async () => {
    const service = createService(
      [fact('sensitive_skin')],
      [
        product({
          id: 1,
          name: 'Conflicted Sensitive Cream',
          tags: [tag('sensitive_skin')],
          productAnalysis: analysis({
            matchedConcepts: ['sensitive_skin'],
            warnings: ['sensitive_skin_risk'],
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].evidence.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'sensitive_skin_match_but_risky',
          domain: 'skin',
          severity: 'high',
        }),
      ]),
    );
    expect(result.recommendations[0].confidenceLevel).toBe('low');
  });

  it('sorts blocked products below non-blocked products', async () => {
    const safeProduct = product({
      id: 1,
      name: 'Calm Serum',
      tags: [tag('sensitive_skin')],
      productAnalysis: analysis({
        matchedConcepts: ['sensitive_skin'],
        ingredient: ingredientIntelligence({
          benefits: ['hydration'],
          scores: { hydrationBoost: 20 },
        }),
      }),
    });
    const blockedProduct = product({
      id: 2,
      name: 'Fragranced Serum',
      tags: [tag('sensitive_skin')],
      productAnalysis: analysis({
        matchedConcepts: ['sensitive_skin'],
        warnings: ['contains_fragrance'],
        ingredient: ingredientIntelligence({
          benefits: ['hydration'],
          warnings: ['contains_fragrance'],
          scores: { hydrationBoost: 20, irritationPenalty: 30 },
        }),
      }),
    });
    const service = createService(
      [fact('sensitive_skin')],
      [blockedProduct, safeProduct],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].product.id).toBe(1);
    expect(result.recommendations[0].blocked).toBe(false);
    expect(result.recommendations[1].product.id).toBe(2);
    expect(result.recommendations[1].blocked).toBe(true);
  });

  it('returns score breakdown positives, negatives, and blockers', async () => {
    const service = createService(
      [fact('sensitive_skin')],
      [
        product({
          id: 1,
          name: 'Fragranced Sensitive Cream',
          tags: [tag('sensitive_skin')],
          productAnalysis: analysis({
            matchedConcepts: ['sensitive_skin'],
            warnings: ['contains_fragrance'],
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const breakdown = result.recommendations[0].scoreBreakdown;

    expect(breakdown.positives.length).toBeGreaterThan(0);
    expect(breakdown.negatives.length).toBeGreaterThan(0);
    expect(breakdown.blockers.length).toBeGreaterThan(0);
    expect(breakdown.finalScore).toBe(
      result.recommendations[0].recommendationScoreV5,
    );
  });

  it('includes v5 score impacts in the explanation', async () => {
    const service = createService(
      [fact('sensitive_skin')],
      [
        product({
          id: 1,
          name: 'Fragranced Sensitive Cream',
          tags: [tag('sensitive_skin')],
          productAnalysis: analysis({
            matchedConcepts: ['sensitive_skin'],
            warnings: ['contains_fragrance'],
          }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const explanation = result.recommendations[0].explanation;

    expect(explanation.summary).toBe(
      'Not recommended due to strong risk signals for this customer.',
    );
    expect(explanation.scoreImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'fragrance_sensitive_skin_blocker',
          domain: 'skin',
          impact: -60,
          direction: 'negative',
        }),
      ]),
    );
  });

  it('keeps existing recommendation fields', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Hydrating Cream',
          tags: [tag('dry_skin')],
          productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);
    const recommendation = result.recommendations[0];

    expect(result.beautyProfileSummary).toEqual(
      expect.objectContaining({
        domainsDetected: ['skin'],
        confidenceLevel: 'high',
      }),
    );
    expect(recommendation.product).toBeDefined();
    expect(recommendation.score).toBeDefined();
    expect(recommendation.reasons).toBeDefined();
    expect(recommendation.warnings).toBeDefined();
    expect(recommendation.explanation).toBeDefined();
    expect(recommendation.confidence).toBeDefined();
    expect(recommendation.confidenceLevel).toBeDefined();
    expect(recommendation.evidence).toBeDefined();
    expect(recommendation.profileAlignment).toEqual(
      expect.objectContaining({
        matchedSignals: expect.any(Array),
        riskSignals: expect.any(Array),
        domainAlignment: expect.any(Object),
      }),
    );
  });

  it('includes unified beauty profile in the customer profile response', async () => {
    const service = createService(
      [fact('dry_skin'), fact('sensitive_skin')],
      [],
    );

    const result = await service.getCustomerProfile(1);

    expect(result.customer).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.facts).toBeDefined();
    expect(result.recentEvents).toBeDefined();
    expect(result.matchedTaxonomy).toBeDefined();
    expect(result.unifiedBeautyProfile).toEqual(
      expect.objectContaining({
        customerId: 1,
        evidenceSummary: expect.objectContaining({
          domainsDetected: ['skin'],
        }),
      }),
    );
    expect(
      result.unifiedBeautyProfile.domains.skin.signals.map(
        (signal) => signal.key,
      ),
    ).toEqual(expect.arrayContaining(['dry_skin', 'sensitive_skin']));
  });

  it('includes multiple recommendation domains when product signals span domains', async () => {
    const service = createService(
      [fact('dry_skin')],
      [
        product({
          id: 1,
          name: 'Skin and Hair Oil',
          tags: [tag('dry_skin'), tag('dry_hair')],
          productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
        }),
      ],
    );

    const result = await service.getCustomerRecommendations(1);

    expect(result.recommendations[0].domains).toEqual(['skin', 'hair']);
  });

  it('maps unknown facts to the general domain', () => {
    expect(
      getFactDomain({
        type: 'preference',
        value: 'unknown_signal',
      } as CustomerFact),
    ).toBe('general');
  });

  it('maps hair normalized keys to the hair domain', () => {
    expect(getProductTagDomain(tag('dry_hair'))).toBe('hair');
    expect(getProductTagDomain(tag('sensitive_scalp'))).toBe('hair');
    expect(getProductTagDomain(tag('contains_sulfates'))).toBe('hair');
  });

  it('maps fragrance normalized keys to the fragrance domain', () => {
    expect(getProductTagDomain(tag('woody'))).toBe('fragrance');
    expect(getProductTagDomain(tag('office_safe'))).toBe('fragrance');
    expect(getProductTagDomain(tag('projection_strong'))).toBe('fragrance');
    expect(getProductTagDomain(tag('fragrance_allergen_risk'))).toBe(
      'fragrance',
    );
  });

  it('maps nail normalized keys to the nails domain', () => {
    expect(getProductTagDomain(tag('brittle_nails'))).toBe('nails');
  });
});
