import { ProductCardBlockMapper } from './product-card-block.mapper';
import type { ProductRecommendationCard } from '../recommendation/product-recommendation-card.types';

function card(
  productId: string,
  overrides: Partial<ProductRecommendationCard> = {},
): ProductRecommendationCard {
  return {
    schemaVersion: 'ai-arman-product-card-v1',
    type: 'product_card',
    position: Number(productId),
    label: productId === '1' ? 'Bäst matchning' : 'Godkänt alternativ',
    productId,
    title: `Produkt ${productId}`,
    imageUrl: `https://www.harmoniq.se/product-${productId}.jpg`,
    productUrl: `https://www.harmoniq.se/product-${productId}`,
    price: { amount: 199, currency: 'SEK' },
    availability: { status: 'in_stock', quantity: 2 },
    whyItFits: ['Bra matchning', 'Bra matchning'],
    inciSignals: ['Relevant INCI-signal'],
    limitations: ['Verifiera individuell tolerans'],
    quality: {
      score: 85,
      rankingScore: 87,
      tier: 'A',
      confidence: 90,
    },
    verification: {
      productFactsSource: 'vendre',
      fetchedAt: '2026-08-07T18:00:00.000Z',
    },
    ...overrides,
  };
}

describe('ProductCardBlockMapper', () => {
  it('returns no block for zero verified cards', () => {
    const mapper = new ProductCardBlockMapper();

    expect(mapper.compose([])).toBeNull();
  });

  it.each([1, 2])('preserves exactly %i verified card(s)', (count) => {
    const mapper = new ProductCardBlockMapper();
    const cards = Array.from({ length: count }, (_, index) =>
      card(String(index + 1)),
    );

    const block = mapper.compose(cards);

    expect(block?.type).toBe('product_cards');
    expect(block?.cards).toHaveLength(count);
    expect(block?.cards.map((item) => item.productId)).toEqual(
      cards.map((item) => item.productId),
    );
    expect(block?.cards[0]).toMatchObject({
      price: 199,
      currency: 'SEK',
      stockStatus: 'in_stock',
      usage: [],
      factsFetchedAt: '2026-08-07T18:00:00.000Z',
    });
    expect(block?.cards[0].whyItFits).toEqual(['Bra matchning']);
  });

  it('never maps more than three verified cards', () => {
    const mapper = new ProductCardBlockMapper();

    const block = mapper.compose([
      card('1'),
      card('2'),
      card('3'),
      card('4'),
    ]);

    expect(block?.cards.map((item) => item.productId)).toEqual(['1', '2', '3']);
  });

  it('fails closed instead of converting a non-SEK price', () => {
    const mapper = new ProductCardBlockMapper();

    expect(() =>
      mapper.compose([
        card('1', {
          price: { amount: 19, currency: 'EUR' },
        }),
      ]),
    ).toThrow('verified_product_card_invalid');
  });

  it('fails closed when live verification metadata is invalid', () => {
    const mapper = new ProductCardBlockMapper();

    expect(() =>
      mapper.compose([
        card('1', {
          verification: {
            productFactsSource: 'vendre',
            fetchedAt: 'not-a-date',
          },
        }),
      ]),
    ).toThrow('verified_product_card_invalid');
  });
});
