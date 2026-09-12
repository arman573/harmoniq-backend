import { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';
import { RecommendationScoringService } from '../recommendation/recommendation-scoring.service';
import { ProductIntelligenceClient } from '../integrations/product-intelligence.client';
import { PRODUCT_INTELLIGENCE_CONTRACT_VERSION } from '../integrations/product-intelligence.types';

describe('ProductIntelligenceEnrichmentService', () => {
  it('makes a complete verified analysis recommendation-ready', async () => {
    const client = {
      evaluate: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 12,
        engineVersion: 'ingredient-intelligence-v3',
        generatedAt: '2026-08-04T15:00:00.000Z',
        analyses: [
          {
            productId: '123',
            designation: {
              normalized: 'fuktgivande schampo',
              score: 94,
              reasons: ['Rätt produkttyp för kundens behov.'],
            },
            inci: {
              original: 'Aqua, Glycerin, Panthenol',
              suitabilityScore: 91,
              signals: ['fuktbindare', 'panthenol'],
              conflicts: [],
              confidence: 93,
              engineVersion: 'ingredient-intelligence-v3',
              analyzedAt: '2026-08-04T14:59:00.000Z',
            },
            category: {
              score: 90,
              reasons: ['Schampo för torrt hår.'],
              values: ['hårvård', 'schampo'],
            },
            tags: {
              score: 82,
              reasons: ['färgat hår'],
              values: ['färgat hår', 'fukt'],
            },
            hardBlockers: [],
            limitations: ['Innehåller parfym.'],
            usage: ['Massera i hårbotten och skölj.'],
            specialFit: ['torrt hår', 'färgat hår'],
            evidence: [
              {
                source: 'ingredient_intelligence',
                key: 'glycerin',
                confidence: 0.93,
                direction: 'positive',
                reason: 'Fuktbindande signal.',
              },
            ],
          },
        ],
      }),
    } as unknown as ProductIntelligenceClient;

    const service = new ProductIntelligenceEnrichmentService(
      client,
      new RecommendationScoringService(),
    );

    const result = await service.enrich({
      message: 'Jag behöver schampo för torrt färgat hår',
      products: [{ productId: '123', title: 'Testschampo' }],
    });

    expect(result.ok).toBe(true);
    expect(result.summary.eligible).toBe(1);
    expect(result.recommendations[0].productId).toBe('123');
    expect(result.recommendations[0].hardBlockers).toEqual([]);
  });

  it('normalizes 0-1 confidence and exposes OpenAI cost and source metadata', async () => {
    const client = {
      evaluate: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 24,
        engineVersion: 'product-intelligence-deterministic-v1',
        generatedAt: '2026-08-04T19:00:00.000Z',
        verification: {
          enabled: true,
          attempted: true,
          required: false,
          reason: 'openai_verification_completed',
          model: 'gpt-5.6-luna',
          webSearchUsed: true,
          cacheHit: false,
          usage: {
            inputTokens: 1000,
            cachedInputTokens: 800,
            outputTokens: 200,
            totalTokens: 1200,
          },
          products: [
            {
              productId: '123',
              verdict: 'supported',
              summary: 'Fuktbindande stöd är rimligt utifrån INCI.',
              ingredientFindings: ['Glycerin är en fuktbindare.'],
              problemSolving: ['Kombinera med balsam i längderna.'],
              cautions: [],
              confidence: 0.88,
              recommendationAction: 'retain',
              sources: [
                { title: 'Regulatorisk källa', url: 'https://example.com/source' },
              ],
              model: 'gpt-5.6-luna',
              webSearchUsed: true,
              cached: false,
            },
          ],
        },
        analyses: [
          {
            productId: '123',
            designation: {
              normalized: 'fuktgivande schampo',
              score: 94,
              reasons: ['Rätt produkttyp.'],
            },
            inci: {
              original: 'Aqua, Glycerin, Panthenol',
              suitabilityScore: 91,
              signals: ['fuktbindare'],
              conflicts: [],
              confidence: 0.93,
              engineVersion: 'product-intelligence-deterministic-v1',
              analyzedAt: '2026-08-04T19:00:00.000Z',
            },
            category: { score: 90, reasons: ['Schampo.'], values: ['schampo'] },
            tags: { score: 82, reasons: ['Fukt.'], values: ['fukt'] },
            hardBlockers: [],
            limitations: [],
            usage: [],
            specialFit: [],
            evidence: [
              {
                source: 'ingredient_intelligence',
                key: 'glycerin',
                confidence: 0.93,
              },
            ],
          },
        ],
      }),
    } as unknown as ProductIntelligenceClient;

    const service = new ProductIntelligenceEnrichmentService(
      client,
      new RecommendationScoringService(),
    );

    const result = await service.enrich({
      message: 'Finns det forskning på glycerin för torrt hår?',
      products: [{ productId: '123', title: 'Testschampo' }],
    });

    expect(result.recommendations[0].evidence.confidence).toBe(93);
    expect(result.verification?.products[0].confidence).toBe(88);
    expect(result.verification?.usage?.cachedInputTokens).toBe(800);
    expect(result.verification?.products[0].sources[0].url).toBe(
      'https://example.com/source',
    );
    expect(result.safety.deterministicBlockersAuthoritative).toBe(true);
  });

  it('keeps a high-scoring analysis blocked when original INCI is missing', async () => {
    const client = {
      evaluate: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 7,
        engineVersion: 'ingredient-intelligence-v3',
        generatedAt: '2026-08-04T15:00:00.000Z',
        analyses: [
          {
            productId: '456',
            designation: {
              normalized: 'fuktgivande schampo',
              score: 100,
              reasons: ['Rätt produkttyp.'],
            },
            inci: {
              original: '',
              suitabilityScore: 100,
              signals: ['fuktbindare'],
              conflicts: [],
              confidence: 100,
              engineVersion: 'ingredient-intelligence-v3',
              analyzedAt: '2026-08-04T14:59:00.000Z',
            },
            category: { score: 100, reasons: [], values: [] },
            tags: { score: 100, reasons: [], values: [] },
            hardBlockers: [],
            limitations: [],
            usage: [],
            specialFit: [],
            evidence: [
              {
                source: 'rule',
                key: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
                confidence: 1,
              },
            ],
          },
        ],
      }),
    } as unknown as ProductIntelligenceClient;

    const service = new ProductIntelligenceEnrichmentService(
      client,
      new RecommendationScoringService(),
    );

    const result = await service.enrich({
      message: 'Jag behöver ett schampo',
      products: [{ productId: '456', title: 'Ofullständig produkt' }],
    });

    expect(result.summary.eligible).toBe(0);
    expect(result.rejected[0].rejectionReasons).toContain(
      'hard_blocker:missing_original_inci',
    );
  });

  it('blocks every product when the intelligence service is unavailable', async () => {
    const client = {
      evaluate: jest.fn().mockResolvedValue({
        ok: false,
        configured: false,
        durationMs: 0,
        analyses: [],
        error: 'product_intelligence_not_configured',
      }),
    } as unknown as ProductIntelligenceClient;

    const service = new ProductIntelligenceEnrichmentService(
      client,
      new RecommendationScoringService(),
    );

    const result = await service.enrich({
      message: 'Jag behöver schampo',
      products: [{ productId: '789', title: 'Okänd produkt' }],
    });

    expect(result.ok).toBe(false);
    expect(result.summary.eligible).toBe(0);
    expect(result.rejected[0].rejectionReasons).toContain(
      'hard_blocker:missing_verified_product_intelligence',
    );
  });
});
