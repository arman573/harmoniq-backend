import { ProductRecommendationCardService } from './product-recommendation-card.service';
import type { ScoredRecommendationCandidate } from './recommendation.types';
import type { ProductLiveFact } from '../integrations/product-live-facts.types';

function candidate(
  productId: string,
  title: string,
  overrides: Partial<ScoredRecommendationCandidate> = {},
) {
  const liveFacts: ProductLiveFact = {
    productId,
    canonicalUrl: `https://www.harmoniq.se/product-${productId}`,
    title,
    imageUrl: `https://www.harmoniq.se/product-${productId}.jpg`,
    price: { amount: 199, currency: 'SEK' },
    stock: { quantity: 3, availability: 'in_stock' },
    active: true,
    visible: true,
    source: 'vendre',
    fetchedAt: '2026-08-07T17:00:00.000Z',
  };

  return {
    productId,
    title,
    scores: {
      designation: 90,
      inciSuitability: 85,
      category: 80,
      tags: 75,
    },
    hardBlockers: [],
    personalizationScore: 0,
    evidence: {
      designationReasons: ['Bra benämningsmatch'],
      inciSignals: ['Relevant INCI-signal'],
      categoryReasons: ['Rätt kategori'],
      tagReasons: ['Relevant tagg'],
      limitations: ['Verifiera individuell tolerans'],
      confidence: 90,
      engineVersion: 'test-engine-v1',
    },
    qualityScore: 85,
    rankingScore: 85,
    tier: 'A' as const,
    eligible: true,
    rejectionReasons: [],
    boundedPersonalizationScore: 0,
    liveFacts,
    ...overrides,
  };
}

describe('ProductRecommendationCardService', () => {
  it('composes structured cards only from verified recommendation data', () => {
    const service = new ProductRecommendationCardService();

    const cards = service.compose([candidate('1', 'Produkt 1')]);

    expect(cards).toEqual([
      {
        schemaVersion: 'ai-arman-product-card-v1',
        type: 'product_card',
        position: 1,
        label: 'Bäst matchning',
        productId: '1',
        title: 'Produkt 1',
        imageUrl: 'https://www.harmoniq.se/product-1.jpg',
        productUrl: 'https://www.harmoniq.se/product-1',
        price: { amount: 199, currency: 'SEK' },
        availability: { status: 'in_stock', quantity: 3 },
        whyItFits: [
          'Bra benämningsmatch',
          'Rätt kategori',
          'Relevant tagg',
        ],
        inciSignals: ['Relevant INCI-signal'],
        limitations: ['Verifiera individuell tolerans'],
        quality: {
          score: 85,
          rankingScore: 85,
          tier: 'A',
          confidence: 90,
        },
        verification: {
          productFactsSource: 'vendre',
          fetchedAt: '2026-08-07T17:00:00.000Z',
        },
      },
    ]);
  });

  it('preserves backend ranking order and never fills beyond three cards', () => {
    const service = new ProductRecommendationCardService();

    const cards = service.compose([
      candidate('1', 'Produkt 1'),
      candidate('2', 'Produkt 2'),
      candidate('3', 'Produkt 3'),
      candidate('4', 'Produkt 4'),
    ]);

    expect(cards.map((card) => card.productId)).toEqual(['1', '2', '3']);
    expect(cards.map((card) => card.position)).toEqual([1, 2, 3]);
    expect(cards.map((card) => card.label)).toEqual([
      'Bäst matchning',
      'Godkänt alternativ',
      'Godkänt alternativ',
    ]);
  });

  it('fails closed for an ineligible recommendation', () => {
    const service = new ProductRecommendationCardService();

    expect(() =>
      service.compose([
        candidate('1', 'Produkt 1', {
          eligible: false,
          tier: 'REJECTED',
        }),
      ]),
    ).toThrow('eligible_recommendation_required');
  });

  it('fails closed when live product facts are not verified', () => {
    const service = new ProductRecommendationCardService();
    const unsafe = candidate('1', 'Produkt 1');
    unsafe.liveFacts.visible = false;

    expect(() => service.compose([unsafe])).toThrow(
      'verified_product_live_facts_required',
    );
  });

  it('returns no cards rather than inventing fallback products', () => {
    const service = new ProductRecommendationCardService();

    expect(service.compose([])).toEqual([]);
  });
});
