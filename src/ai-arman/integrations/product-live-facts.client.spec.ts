import { ProductLiveFactsClient } from './product-live-facts.client';


describe('ProductLiveFactsClient', () => {
  it('fails closed when live product facts are not configured', async () => {
    const client = new ProductLiveFactsClient();

    const result = await client.getFacts(['123', '456']);

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
    const client = new ProductLiveFactsClient();

    const result = await client.getFacts([]);

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.readOnly).toBe(true);
    expect(result.facts).toEqual([]);
    expect(result.error).toBe('product_live_facts_invalid_request');
  });

  it('normalizes duplicate and blank product ids', async () => {
    const client = new ProductLiveFactsClient();

    const result = await client.getFacts([' 123 ', '', '123', '456', '   ']);

    expect(result.requestedProductIds).toEqual(['123', '456']);
    expect(result.missingProductIds).toEqual(['123', '456']);
  });

  it('limits a lookup to 25 backend-owned product ids', async () => {
    const client = new ProductLiveFactsClient();
    const productIds = Array.from({ length: 30 }, (_, index) => String(index + 1));

    const result = await client.getFacts(productIds);

    expect(result.requestedProductIds).toHaveLength(25);
    expect(result.requestedProductIds[0]).toBe('1');
    expect(result.requestedProductIds[24]).toBe('25');
    expect(result.missingProductIds).toEqual(result.requestedProductIds);
    expect(result.facts).toEqual([]);
  });
});
