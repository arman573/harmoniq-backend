import { IngredientIntelligenceResult } from '../ingredients/ingredients.service';
import { ProductAnalysis } from '../products/product-analysis.entity';
import { ProductTag } from '../products/product-tag.entity';
import { CustomerFact } from '../tickets/customer-fact.entity';
import { ExplainabilityService } from './explainability.service';

const emptyIngredientIntelligence: IngredientIntelligenceResult = {
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
};

function fact(value: string) {
  return { type: 'skin_need', value } as CustomerFact;
}

function tag(normalizedKey: string) {
  return { name: normalizedKey, normalizedKey } as ProductTag;
}

function analysis(overrides: Partial<ProductAnalysis>) {
  return {
    status: 'completed',
    confidence: 0.8,
    warnings: [],
    matchedConcepts: [],
    rawAnalysis: {},
    ...overrides,
  } as ProductAnalysis;
}

function ingredients(
  overrides: Partial<IngredientIntelligenceResult>,
): IngredientIntelligenceResult {
  return {
    ...emptyIngredientIntelligence,
    ...overrides,
    scores: {
      ...emptyIngredientIntelligence.scores,
      ...overrides.scores,
    },
  };
}

describe('ExplainabilityService', () => {
  const service = new ExplainabilityService();

  it('generates a dry skin match reason', () => {
    const explanation = service.generateProductExplanation({
      customerFacts: [fact('dry_skin')],
      productTags: [tag('dry_skin')],
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'matches_dry_skin' }),
      ]),
    );
  });

  it('generates a sensitive skin match reason', () => {
    const explanation = service.generateProductExplanation({
      customerFacts: [fact('sensitive_skin')],
      productAnalysis: analysis({ matchedConcepts: ['sensitive_skin'] }),
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'matches_sensitive_skin' }),
      ]),
    );
  });

  it('generates a hydration support reason', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({
        benefits: ['hydration'],
        scores: { hydrationBoost: 20 },
      }),
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'hydration_support' }),
      ]),
    );
  });

  it('generates a barrier support reason', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({
        benefits: ['barrier_support'],
        scores: { barrierSupportBoost: 25 },
      }),
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'barrier_support' }),
      ]),
    );
  });

  it('generates a dry hair support reason from score breakdown', () => {
    const explanation = service.generateProductExplanation({
      scoreBreakdown: {
        positives: [
          {
            code: 'supports_dry_hair',
            domain: 'hair',
            label: 'Supports dry hair',
            impact: 25,
          },
        ],
      },
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'supports_dry_hair',
          label: 'Supports dry hair',
        }),
      ]),
    );
    expect(explanation.scoreImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'supports_dry_hair', domain: 'hair' }),
      ]),
    );
  });

  it('generates curly hair and color-safe support reasons', () => {
    const explanation = service.generateProductExplanation({
      scoreBreakdown: {
        positives: [
          {
            code: 'supports_curly_hair',
            domain: 'hair',
            label: 'Supports curly hair',
            impact: 25,
          },
          {
            code: 'color_safe_support',
            domain: 'hair',
            label: 'Color-safe support',
            impact: 30,
          },
        ],
      },
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'supports_curly_hair' }),
        expect.objectContaining({ code: 'color_safe_support' }),
      ]),
    );
  });

  it('generates fragrance support reasons from score breakdown', () => {
    const explanation = service.generateProductExplanation({
      scoreBreakdown: {
        positives: [
          {
            code: 'matches_floral',
            domain: 'fragrance',
            label: 'Matches floral preference',
            impact: 25,
          },
          {
            code: 'office_safe_projection',
            domain: 'fragrance',
            label: 'Office-safe projection',
            impact: 20,
          },
          {
            code: 'signature_scent_longevity',
            domain: 'fragrance',
            label: 'Long-lasting signature scent',
            impact: 20,
          },
        ],
      },
    });

    expect(explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'matches_floral' }),
        expect.objectContaining({ code: 'office_safe_projection' }),
        expect.objectContaining({ code: 'signature_scent_longevity' }),
      ]),
    );
    expect(explanation.scoreImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'matches_floral',
          domain: 'fragrance',
        }),
      ]),
    );
  });

  it('generates a fragrance warning', () => {
    const explanation = service.generateProductExplanation({
      productAnalysis: analysis({ warnings: ['contains_fragrance'] }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'contains_fragrance' }),
      ]),
    );
  });

  it('generates fragrance warning explanations', () => {
    const explanation = service.generateProductExplanation({
      productAnalysis: analysis({
        warnings: [
          'projection_strong',
          'migraine_trigger_risk',
          'fragrance_allergen_risk',
          'cloying_sweetness_risk',
        ],
      }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'projection_strong' }),
        expect.objectContaining({ code: 'migraine_trigger_risk' }),
        expect.objectContaining({ code: 'fragrance_allergen_risk' }),
        expect.objectContaining({ code: 'cloying_sweetness_risk' }),
      ]),
    );
    expect(explanation.scoreImpact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'fragrance_allergen_risk',
          domain: 'fragrance',
        }),
      ]),
    );
  });

  it('generates hair warning explanations', () => {
    const explanation = service.generateProductExplanation({
      productAnalysis: analysis({
        warnings: [
          'contains_sulfates',
          'color_stripping_risk',
          'scalp_irritation_risk',
        ],
      }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'contains_sulfates' }),
        expect.objectContaining({ code: 'color_stripping_risk' }),
        expect.objectContaining({ code: 'scalp_irritation_risk' }),
      ]),
    );
  });

  it('generates a drying alcohol warning', () => {
    const explanation = service.generateProductExplanation({
      productAnalysis: analysis({ warnings: ['contains_drying_alcohol'] }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'contains_drying_alcohol' }),
      ]),
    );
  });

  it('generates a comedogenic warning', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({
        warnings: ['comedogenic_risk'],
        scores: { acneRiskPenalty: 30 },
      }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'comedogenic_risk' }),
      ]),
    );
  });

  it('generates a sensitive skin warning', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({
        warnings: ['sensitive_skin_risk'],
        scores: { irritationPenalty: 30 },
      }),
    });

    expect(explanation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'sensitive_skin_risk' }),
      ]),
    );
  });

  it('summarizes positives only', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({ benefits: ['hydration'] }),
    });

    expect(explanation.summary).toBe(
      'Strong match based on skin needs and ingredient profile.',
    );
  });

  it('summarizes positives plus warnings', () => {
    const explanation = service.generateProductExplanation({
      ingredientIntelligence: ingredients({
        benefits: ['hydration'],
        warnings: ['contains_fragrance'],
      }),
    });

    expect(explanation.summary).toBe(
      'Potential match, but review warnings before recommending.',
    );
  });

  it('summarizes warnings only', () => {
    const explanation = service.generateProductExplanation({
      productAnalysis: analysis({ warnings: ['contains_fragrance'] }),
    });

    expect(explanation.summary).toBe(
      'Use caution due to product risk signals.',
    );
  });

  it('deduplicates reasons by code', () => {
    const explanation = service.generateProductExplanation({
      customerFacts: [fact('dry_skin')],
      productTags: [tag('dry_skin')],
      productAnalysis: analysis({ matchedConcepts: ['dry_skin'] }),
    });

    expect(
      explanation.reasons.filter(
        (reason) => reason.code === 'matches_dry_skin',
      ),
    ).toHaveLength(1);
  });
});
