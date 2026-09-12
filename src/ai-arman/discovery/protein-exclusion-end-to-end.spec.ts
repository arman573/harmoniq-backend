import { ChatMessagesService } from '../chat/chat-messages.service';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import type { ProductIntelligenceClient } from '../integrations/product-intelligence.client';
import type { ProductLiveFactsClient } from '../integrations/product-live-facts.client';
import { RecommendationScoringService } from '../recommendation/recommendation-scoring.service';
import { ProductRecommendationCardService } from '../recommendation/product-recommendation-card.service';
import { HaircareRecommendationJourneyService } from './haircare-recommendation-journey.service';
import type { ProductDiscoveryService } from './product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';

describe('Protein exclusion end-to-end contract', () => {
  it('normalizes explicit protein avoidance to the canonical Customer Core exclusion', () => {
    const response = new ChatMessagesService().handle({
      contractVersion: 'ai-arman-chat-v1',
      clientMessageId: 'protein-exclusion-1',
      message: {
        text: 'Jag söker en hårinpackning för skadat hår utan protein',
      },
    });

    expect(response.interpretation.entities.recommendationDomain).toBe('haircare');
    expect(response.interpretation.entities.exclusions).toContain('proteins');
    expect(response.decision.plannedTools).toEqual([
      'search_products',
      'analyze_product_suitability',
      'get_product_live_facts',
    ]);
  });

  it('propagates the canonical protein exclusion as utan protein to Product Intelligence', async () => {
    const discovery = {
      discover: jest.fn().mockResolvedValue({
        ok: true,
        productsFound: 1,
        candidates: [
          {
            productId: '1004',
            title: 'Repair Protein Mask',
            discovery: {
              url: 'https://www.harmoniq.se/repair-protein-mask-1004',
              imageUrl: 'https://www.harmoniq.se/repair-protein-mask-1004.jpg',
            },
          },
        ],
      }),
    } as unknown as ProductDiscoveryService;
    const enrichment = {
      enrich: jest.fn().mockResolvedValue({
        recommendations: [],
        rejected: [
          {
            productId: '1004',
            hardBlockers: ['protein_conflict'],
            eligible: false,
          },
        ],
      }),
    } as unknown as ProductIntelligenceEnrichmentService;
    const liveFacts = {
      getFacts: jest.fn(),
    } as unknown as ProductLiveFactsClient;
    const service = new HaircareRecommendationJourneyService(
      discovery,
      enrichment,
      liveFacts,
      new ProductRecommendationCardService(),
    );
    const interpretation: AiArmanInterpretation = {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'deterministic_fallback',
      locale: 'sv-SE',
      primaryIntent: 'product_recommendation',
      secondaryIntents: [],
      confidence: 0.72,
      entities: {
        requestedProductTypes: ['hair_mask'],
        needs: ['damaged_hair'],
        exclusions: ['proteins'],
        orderReference: null,
        productReferences: [],
        recommendationDomain: 'haircare',
        skincareRoutineActives: [],
      },
      missingFields: [],
      requiresIdentity: false,
      requiresHumanReview: false,
    };

    const result = await service.prepare(interpretation);
    const expectedQuery = 'hårinpackning skadat hår utan protein';

    expect(discovery.discover).toHaveBeenCalledWith(expectedQuery);
    expect(enrichment.enrich).toHaveBeenCalledWith(
      expect.objectContaining({ message: expectedQuery }),
    );
    expect(result.status).toBe('no_verified_candidates');
    expect(result.productCards).toEqual([]);
    expect(liveFacts.getFacts).not.toHaveBeenCalled();
  });

  it('keeps a Product Intelligence protein_conflict as an absolute recommendation blocker', async () => {
    const client = {
      evaluate: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 5,
        engineVersion: 'product-intelligence-deterministic-v1',
        generatedAt: '2026-08-12T13:00:00.000Z',
        analyses: [
          {
            productId: '1004',
            designation: {
              normalized: 'reparerande hårinpackning',
              score: 95,
              reasons: ['Rätt produkttyp.'],
            },
            inci: {
              original: 'Aqua, Hydrolyzed Keratin, Hydrolyzed Wheat Protein, Panthenol',
              suitabilityScore: 95,
              signals: ['protein- eller aminosyrastöd'],
              conflicts: [
                'Produkten innehåller protein trots att kunden vill undvika protein.',
              ],
              confidence: 0.95,
              engineVersion: 'product-intelligence-deterministic-v1',
              analyzedAt: '2026-08-12T13:00:00.000Z',
            },
            category: {
              score: 95,
              reasons: ['Hårinpackning för skadat hår.'],
              values: ['hårinpackning', 'skadat hår'],
            },
            tags: {
              score: 90,
              reasons: ['Reparerande.'],
              values: ['reparerande', 'protein'],
            },
            hardBlockers: ['protein_conflict'],
            limitations: [
              'Produkten innehåller protein trots att kunden vill undvika protein.',
            ],
            usage: [],
            specialFit: ['skadat hår'],
            evidence: [
              {
                source: 'rule',
                key: 'protein_conflict',
                confidence: 0.95,
                direction: 'negative',
                reason: 'Explicit protein avoidance conflicts with verified INCI.',
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
      message: 'hårinpackning skadat hår utan protein',
      products: [{ productId: '1004', title: 'Repair Protein Mask' }],
    });

    expect(result.summary.eligible).toBe(0);
    expect(result.recommendations).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].rejectionReasons).toContain(
      'hard_blocker:protein_conflict',
    );
    expect(result.safety.deterministicBlockersAuthoritative).toBe(true);
  });
});
