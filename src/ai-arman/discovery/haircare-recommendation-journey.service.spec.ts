import { HaircareRecommendationJourneyService } from './haircare-recommendation-journey.service';
import type { ProductDiscoveryService } from './product-discovery.service';
import type { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';

const interpretation: AiArmanInterpretation = {
  schemaVersion: 'ai-arman-interpretation-v1',
  source: 'deterministic_fallback',
  locale: 'sv-SE',
  primaryIntent: 'product_recommendation',
  secondaryIntents: [],
  confidence: 0.72,
  entities: {
    requestedProductTypes: ['shampoo'],
    needs: ['thin_hair', 'color_treated_hair'],
    exclusions: ['fragrance'],
    orderReference: null,
    productReferences: [],
  },
  missingFields: [],
  requiresIdentity: false,
  requiresHumanReview: false,
};

describe('HaircareRecommendationJourneyService', () => {
  it('builds a backend-owned query and keeps recommendations behind live-fact verification', async () => {
    const candidates = Array.from({ length: 30 }, (_, index) => ({
      productId: String(index + 1),
      title: `Produkt ${index + 1}`,
      discovery: { url: `/produkt-${index + 1}` },
    }));
    const discovery = {
      discover: jest.fn().mockResolvedValue({
        ok: true,
        productsFound: 30,
        candidates,
      }),
    } as unknown as ProductDiscoveryService;
    const enrichment = {
      enrich: jest.fn().mockResolvedValue({
        recommendations: [{ productId: '1', eligible: true }],
        rejected: [],
      }),
    } as unknown as ProductIntelligenceEnrichmentService;

    const service = new HaircareRecommendationJourneyService(discovery, enrichment);
    const result = await service.prepare(interpretation);

    expect(discovery.discover).toHaveBeenCalledWith(
      'schampo tunt hår färgat hår utan parfym',
    );
    expect(enrichment.enrich).toHaveBeenCalledWith({
      message: 'schampo tunt hår färgat hår utan parfym',
      products: expect.any(Array),
    });
    expect((enrichment.enrich as jest.Mock).mock.calls[0][0].products).toHaveLength(25);
    expect(result.status).toBe('ready_for_live_facts');
    expect(result.safety.backendOwnedCandidates).toBe(true);
    expect(result.safety.liveProductFactsVerified).toBe(false);
    expect(result.safety.customerProductCardsReady).toBe(false);
  });

  it('does not call Product Intelligence when discovery fails closed', async () => {
    const discovery = {
      discover: jest.fn().mockResolvedValue({
        ok: false,
        productsFound: 0,
        candidates: [],
      }),
    } as unknown as ProductDiscoveryService;
    const enrichment = { enrich: jest.fn() } as unknown as ProductIntelligenceEnrichmentService;

    const service = new HaircareRecommendationJourneyService(discovery, enrichment);
    const result = await service.prepare(interpretation);

    expect(enrichment.enrich).not.toHaveBeenCalled();
    expect(result.status).toBe('no_verified_candidates');
    expect(result.recommendations).toEqual([]);
  });
});
