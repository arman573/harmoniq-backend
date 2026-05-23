import { Repository } from 'typeorm';
import { ExplainabilityService } from '../explainability/explainability.service';
import { Ingredient } from '../ingredients/ingredient.entity';
import {
  IngredientIntelligenceResult,
  IngredientsService,
} from '../ingredients/ingredients.service';
import { TaxonomyTag } from '../taxonomy/taxonomy-tag.entity';
import { ProductAnalysis } from './product-analysis.entity';
import { ProductAnalysisService } from './product-analysis.service';
import { Product } from './product.entity';

const openAiAnalysis = {
  warnings: [],
  matchedConcepts: [],
  scores: {
    hydrationScore: 82,
    acneSafetyScore: 71,
    sensitiveSafetyScore: 64,
  },
  confidence: 0.88,
  ingredients: ['water', 'glycerin'],
};

function createHarness() {
  const product = {
    id: 1,
    name: ' Hydrating Serum ',
    brand: ' Glow Co ',
    description: ' Lightweight hydrating serum ',
    categoryName: ' Serum ',
    categoryPath: ' Skin Care > Serum ',
    mainCategory: ' Skin Care ',
    price: 249,
    quantity: 12,
    specs: [
      {
        id: 1,
        name: ' Ingredients ',
        normalizedKey: ' inci ',
        value: ' Water, Glycerin ',
      },
    ],
    tags: [
      {
        id: 1,
        name: ' Hydrating ',
        normalizedKey: ' dry_skin ',
        domain: ' skin ',
        kind: ' benefit ',
      },
    ],
    analyses: [],
    rawData: {},
  } as Product;

  let analyses: ProductAnalysis[] = [];

  const productRepo = {
    findOne: jest.fn(async () => product),
  } as unknown as Repository<Product>;

  const analysisRepo = {
    findOne: jest.fn(async () => analyses[analyses.length - 1] ?? null),
    create: jest.fn((analysis: ProductAnalysis) => analysis),
    save: jest.fn(async (analysis: ProductAnalysis) => {
      const saved = {
        id: analyses.length + 1,
        createdAt: new Date(2026, 0, analyses.length + 1),
        updatedAt: new Date(2026, 0, analyses.length + 1),
        ...analysis,
      };

      analyses = [...analyses, saved];
      product.analyses = analyses;

      return saved;
    }),
  } as unknown as Repository<ProductAnalysis>;

  const taxonomyTagRepo = {
    find: jest.fn(async () => []),
  } as unknown as Repository<TaxonomyTag>;

  const ingredientRepo = {
    findOne: jest.fn(),
    create: jest.fn((ingredient: Ingredient) => ingredient),
    save: jest.fn(async (ingredient: Ingredient) => ingredient),
  } as unknown as Repository<Ingredient>;

  const ingredientsService = new IngredientsService(ingredientRepo);

  const service = new ProductAnalysisService(
    productRepo,
    analysisRepo,
    taxonomyTagRepo,
    ingredientsService,
    new ExplainabilityService(),
  );
  const generateAnalysis = jest
    .spyOn(service as any, 'generateAnalysis')
    .mockResolvedValue(openAiAnalysis);

  return {
    service,
    product,
    generateAnalysis,
    getAnalyses: () => analyses,
  };
}

describe('ProductAnalysisService cache', () => {
  it('returns a cached analysis when product intelligence data is unchanged', async () => {
    const { service, generateAnalysis } = createHarness();

    const first = await service.analyzeProduct(1);
    const second = await service.analyzeProduct(1);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.explanation).toBeDefined();
    expect(first.analysis.analysisHash).toMatch(/^[a-f0-9]{64}$/);
    expect(second.analysis.id).toBe(first.analysis.id);
    expect(generateAnalysis).toHaveBeenCalledTimes(1);
  });

  it('stores ingredient intelligence on product analysis rawAnalysis', async () => {
    const { service } = createHarness();

    const result = await service.analyzeProduct(1);
    const rawAnalysis = result.analysis.rawAnalysis as Record<string, unknown>;
    const ingredientIntelligence =
      rawAnalysis.ingredientIntelligence as IngredientIntelligenceResult;

    expect(ingredientIntelligence.detectedIngredients).toEqual([
      'glycerin',
      'water',
    ]);
    expect(ingredientIntelligence.knownIngredients).toContain('glycerin');
    expect(ingredientIntelligence.scores.hydrationBoost).toBe(20);
    expect(rawAnalysis.explanation).toEqual(
      expect.objectContaining({
        summary: 'Strong match based on skin needs and ingredient profile.',
      }),
    );
    expect(result.explanation.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'hydration_support' }),
      ]),
    );
    expect(result.analysis.scores?.hydrationScore).toBe(100);
  });

  it('merges deterministic ingredient warnings into final analysis', async () => {
    const { service, product } = createHarness();

    product.specs = [
      {
        id: 1,
        name: ' Ingredients ',
        normalizedKey: ' inci ',
        value: ' Water, Parfum, Alcohol Denat., Coconut Oil ',
      },
    ] as Product['specs'];

    const result = await service.analyzeProduct(1);

    expect(result.analysis.warnings).toEqual(
      expect.arrayContaining([
        'contains_fragrance',
        'contains_drying_alcohol',
        'comedogenic_risk',
        'sensitive_skin_risk',
      ]),
    );
    expect(result.analysis.scores?.acneSafetyScore).toBe(41);
    expect(result.analysis.scores?.sensitiveSafetyScore).toBe(9);
  });

  it('creates a new analysis when description changes', async () => {
    const { service, product, generateAnalysis } = createHarness();

    const first = await service.analyzeProduct(1);

    product.description = ' Rich hydrating barrier serum ';

    const second = await service.analyzeProduct(1);

    expect(second.cached).toBe(false);
    expect(second.analysis.analysisHash).not.toBe(first.analysis.analysisHash);
    expect(generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('creates a new analysis when ingredients change', async () => {
    const { service, product, generateAnalysis } = createHarness();

    const first = await service.analyzeProduct(1);

    product.specs = [
      {
        id: 1,
        name: ' Ingredients ',
        normalizedKey: ' inci ',
        value: ' Water, Niacinamide ',
      },
    ] as Product['specs'];

    const second = await service.analyzeProduct(1);

    expect(second.cached).toBe(false);
    expect(second.analysis.analysisHash).not.toBe(first.analysis.analysisHash);
    expect(generateAnalysis).toHaveBeenCalledTimes(2);
  });

  it('keeps using cache when unrelated commercial fields change', async () => {
    const { service, product, generateAnalysis } = createHarness();

    await service.analyzeProduct(1);

    product.price = 399;
    product.quantity = 0;

    const second = await service.analyzeProduct(1);

    expect(second.cached).toBe(true);
    expect(generateAnalysis).toHaveBeenCalledTimes(1);
  });

  it('treats a matching hash with corrupt analysis data as a cache miss', async () => {
    const { service, generateAnalysis, getAnalyses } = createHarness();

    await service.analyzeProduct(1);

    getAnalyses()[0].scores = undefined;

    const second = await service.analyzeProduct(1);

    expect(second.cached).toBe(false);
    expect(generateAnalysis).toHaveBeenCalledTimes(2);
  });
});
