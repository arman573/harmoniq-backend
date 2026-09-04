import {
  DisabledProductLiveFactsClient,
  normalizeProductLiveFactsRequest,
} from './product-live-facts.client';

function requestProduct(productId: string) {
  return {
    productId,
    title: `Produkt ${productId}`,
    canonicalUrl: `https://www.harmoniq.se/produkt-${productId}`,
    imageUrl: null,
  };
}

describe('DisabledProductLiveFactsClient', () => {
  it('fails closed when live product facts are not configured', async () => {
    const client = new DisabledProductLiveFactsClient();

    const result = await client.getFacts([
      requestProduct('123'),
      requestProduct('456'),
    ]);

    expect(result).toEqual({
      ok: false,
      configured: false,
      readOnly: true,
      source: 'not_configured',
      requestedProductIds: ['123', '456'],
      facts: [],
      missingProductIds: ['123', '456'],
      error: 'product_live_facts_not_configured',
    });
  });

  it('rejects an empty request without returning product facts', async () => {
    const client = new DisabledProductLiveFactsClient();

    const result = await client.getFacts([]);

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(result.facts).toEqual([]);
    expect(result.error).toBe('product_live_facts_invalid_request');
  });

  it('normalizes duplicate and blank metadata ids', async () => {
    const client = new DisabledProductLiveFactsClient();

    const result = await client.getFacts([
      requestProduct(' 123 '),
      requestProduct('123'),
      requestProduct('456'),
      { ...requestProduct(''), productId: '' },
    ]);

    expect(result.requestedProductIds).toEqual(['123', '456']);
    expect(result.missingProductIds).toEqual(['123', '456']);
  });

  it('limits a lookup to 25 backend-owned metadata products', async () => {
    const client = new DisabledProductLiveFactsClient();
    const products = Array.from({ length: 30 }, (_, index) =>
      requestProduct(String(index + 1)),
    );

    const result = await client.getFacts(products);

    expect(result.requestedProductIds).toHaveLength(25);
    expect(result.requestedProductIds[0]).toBe('1');
    expect(result.requestedProductIds[24]).toBe('25');
    expect(result.missingProductIds).toEqual(result.requestedProductIds);
    expect(result.facts).toEqual([]);
  });

  it('accepts backend-owned product metadata while remaining disabled', async () => {
    const client = new DisabledProductLiveFactsClient();

    const result = await client.getFacts([requestProduct('123')]);

    expect(result.requestedProductIds).toEqual(['123']);
    expect(result.error).toBe('product_live_facts_not_configured');
  });

  it('fails closed when unexpected bare ids reach the runtime normalizer', () => {
    expect(normalizeProductLiveFactsRequest(['123', '456'] as unknown)).toEqual(
      [],
    );
  });
});
