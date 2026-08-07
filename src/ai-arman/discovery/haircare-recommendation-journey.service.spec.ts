import { HaircareRecommendationJourneyService } from './haircare-recommendation-journey.service';
import type { ProductDiscoveryService } from './product-discovery.service';
import type { ProductIntelligenceEnrichmentService } from './product-intelligence-enrichment.service';
import type { ProductLiveFactsClient } from '../integrations/product-live-facts.client';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import { ProductRecommendationCardService } from '../recommendation/product-recommendation-card.service';
import type { ScoredRecommendationCandidate } from '../recommendation/recommendation.types';

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

const recommendation: ScoredRecommendationCandidate = {
  productId: '1',
  title: 'Produkt 1',
  scores: { designation: 90, inciSuitability: 85, category: 90, tags: 80 },
  hardBlockers: [],
  personalizationScore: 0,
  evidence: {
    designationReasons: ['match'],
    inciSignals: ['signal'],
    categoryReasons: ['category'],
    tagReasons: ['tag'],
    limitations: [],
    confidence: 90,
    engineVersion: 'test-engine-v1',
  },
  qualityScore: 87,
  rankingScore: 87,
  tier: 'A',
  eligible: true,
  rejectionReasons: [],
  boundedPersonalizationScore: 0,
};

function createDiscovery(ok = true) {
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    productId: String(index + 1),
    title: `Produkt ${index + 1}`,
    discovery: { url: `/produkt-${index + 1}` },
  }));
  return {
    discover: jest.fn().mockResolvedValue({
      ok,
      productsFound: ok ? 30 : 0,
      candidates: ok ? candidates : [],
    }),
  } as unknown as ProductDiscoveryService;
}

function createEnrichment(recommendations = [recommendation]) {
  return {
    enrich: jest.fn().mockResolvedValue({ recommendations, rejected: [] }),
  } as unknown as ProductIntelligenceEnrichmentService;
}

function createService(
  discovery: ProductDiscoveryService,
  enrichment: ProductIntelligenceEnrichmentService,
  productLiveFacts: ProductLiveFactsClient,
) {
  return new HaircareRecommendationJourneyService(
    discovery,
    enrichment,
    productLiveFacts,
    new ProductRecommendationCardService(),
  );
}

describe('HaircareRecommendationJourneyService', () => {
  it('builds a backend-owned query, limits discovery candidates and fails closed when live facts are disabled', async () => {
    const discovery = createDiscovery();
    const enrichment = createEnrichment();
    const productLiveFacts = {
      getFacts: jest.fn().mockResolvedValue({
        ok: false,
        configured: false,
        readOnly: true,
        source: 'not_configured',
        requestedProductIds: ['1'],
        facts: [],
        missingProductIds: ['1'],
        error: 'product_live_facts_not_configured',
      }),
    } as unknown as ProductLiveFactsClient;

    const result = await createService(discovery, enrichment, productLiveFacts).prepare(interpretation);

    expect(discovery.discover).toHaveBeenCalledWith('schampo tunt hår färgat hår utan parfym');
    expect((enrichment.enrich as jest.Mock).mock.calls[0][0].products).toHaveLength(25);
    expect(productLiveFacts.getFacts).toHaveBeenCalledWith(['1']);
    expect(result.status).toBe('live_facts_unavailable');
    expect(result.recommendations).toEqual([]);
    expect(result.productCards).toEqual([]);
    expect(result.safety.liveProductFactsVerified).toBe(false);
    expect(result.safety.customerProductCardsReady).toBe(false);
  });

  it('creates structured product cards only after valid live facts', async () => {
    const discovery = createDiscovery();
    const enrichment = createEnrichment();
    const productLiveFacts = {
      getFacts: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        readOnly: true,
        source: 'vendre',
        requestedProductIds: ['1'],
        missingProductIds: [],
        facts: [{
          productId: '1',
          canonicalUrl: 'https://www.harmoniq.se/produkt-1',
          title: 'Produkt 1',
          imageUrl: 'https://www.harmoniq.se/produkt-1.jpg',
          price: { amount: 199, currency: 'SEK' },
          stock: { quantity: 3, availability: 'in_stock' },
          active: true,
          visible: true,
          source: 'vendre',
          fetchedAt: '2026-08-07T17:00:00.000Z',
        }],
      }),
    } as unknown as ProductLiveFactsClient;

    const result = await createService(discovery, enrichment, productLiveFacts).prepare(interpretation);

    expect(result.status).toBe('product_cards_ready');
    expect(result.recommendations).toHaveLength(1);
    expect(result.productCards).toHaveLength(1);
    expect(result.productCards[0]).toMatchObject({
      schemaVersion: 'ai-arman-product-card-v1',
      type: 'product_card',
      productId: '1',
      title: 'Produkt 1',
      productUrl: 'https://www.harmoniq.se/produkt-1',
      price: { amount: 199, currency: 'SEK' },
      availability: { status: 'in_stock', quantity: 3 },
    });
    expect(result.safety.liveProductFactsVerified).toBe(true);
    expect(result.safety.customerProductCardsReady).toBe(true);
  });

  it('rejects live facts that do not meet product safety requirements and creates no cards', async () => {
    const discovery = createDiscovery();
    const enrichment = createEnrichment();
    const productLiveFacts = {
      getFacts: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        readOnly: true,
        source: 'vendre',
        requestedProductIds: ['1'],
        missingProductIds: [],
        facts: [{
          productId: '1',
          canonicalUrl: 'https://www.harmoniq.se/produkt-1',
          title: 'Produkt 1',
          imageUrl: null,
          price: { amount: 199, currency: 'SEK' },
          stock: { quantity: 0, availability: 'out_of_stock' },
          active: true,
          visible: true,
          source: 'vendre',
          fetchedAt: '2026-08-07T17:00:00.000Z',
        }],
      }),
    } as unknown as ProductLiveFactsClient;

    const result = await createService(discovery, enrichment, productLiveFacts).prepare(interpretation);

    expect(result.status).toBe('no_verified_live_products');
    expect(result.recommendations).toEqual([]);
    expect(result.productCards).toEqual([]);
    expect(result.liveFactsRejected).toEqual([{ productId: '1', reasons: ['product_not_in_stock', 'invalid_stock_quantity'] }]);
    expect(result.safety.customerProductCardsReady).toBe(false);
  });

  it('does not call Product Intelligence or live facts when discovery fails closed', async () => {
    const discovery = createDiscovery(false);
    const enrichment = { enrich: jest.fn() } as unknown as ProductIntelligenceEnrichmentService;
    const productLiveFacts = { getFacts: jest.fn() } as unknown as ProductLiveFactsClient;

    const result = await createService(discovery, enrichment, productLiveFacts).prepare(interpretation);

    expect(enrichment.enrich).not.toHaveBeenCalled();
    expect(productLiveFacts.getFacts).not.toHaveBeenCalled();
    expect(result.status).toBe('no_verified_candidates');
    expect(result.productCards).toEqual([]);
  });
});
