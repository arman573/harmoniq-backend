import { VendreProductLiveFactsClient } from './vendre-product-live-facts.client';

const originalBaseUrl = process.env.VENDRE_API_BASE_URL;
const originalApiKey = process.env.VENDRE_API_KEY;

function requestProduct(productId = '123') {
  return {
    productId,
    title: `Produkt ${productId}`,
    canonicalUrl: `https://www.harmoniq.se/produkt-${productId}`,
    imageUrl: `https://www.harmoniq.se/produkt-${productId}.jpg`,
  };
}

function configureVendre() {
  process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
  process.env.VENDRE_API_KEY = 'test-key';
}

function validProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    name: { sv: 'Produkt 123' },
    price: 100,
    quantity: 2,
    status: true,
    show: true,
    ...overrides,
  };
}

describe('VendreProductLiveFactsClient hardening', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBaseUrl === undefined) delete process.env.VENDRE_API_BASE_URL;
    else process.env.VENDRE_API_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.VENDRE_API_KEY;
    else process.env.VENDRE_API_KEY = originalApiKey;
  });

  it('maps zero quantity to out_of_stock without inventing stock', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validProduct({ quantity: 0 }),
    } as Response);

    const result = await new VendreProductLiveFactsClient().getFacts([
      requestProduct(),
    ]);

    expect(result.ok).toBe(true);
    expect(result.facts[0].stock).toEqual({
      quantity: 0,
      availability: 'out_of_stock',
    });
  });

  it('preserves inactive and hidden Vendre state in live facts', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validProduct({ status: false, show: false }),
    } as Response);

    const result = await new VendreProductLiveFactsClient().getFacts([
      requestProduct(),
    ]);

    expect(result.ok).toBe(true);
    expect(result.facts[0]).toMatchObject({
      active: false,
      visible: false,
    });
  });

  it('accepts the supported Vendre data wrapper', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: validProduct() }),
    } as Response);

    const result = await new VendreProductLiveFactsClient().getFacts([
      requestProduct(),
    ]);

    expect(result.ok).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].productId).toBe('123');
  });

  it.each([
    ['missing title', { name: undefined }],
    ['blank title', { name: { sv: '   ' } }],
    ['missing price', { price: undefined }],
    ['invalid price', { price: 'not-a-price' }],
    ['zero price', { price: 0 }],
    ['invalid quantity', { quantity: 'many' }],
  ])('fails closed for %s', async (_label, overrides) => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validProduct(overrides),
    } as Response);

    const result = await new VendreProductLiveFactsClient().getFacts([
      requestProduct(),
    ]);

    expect(result.ok).toBe(false);
    expect(result.facts).toEqual([]);
    expect(result.missingProductIds).toEqual(['123']);
    expect(result.error).toBe('product_live_facts_invalid_response');
  });

  it('prioritizes upstream_error when every product fails with mixed errors', async () => {
    configureVendre();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validProduct({ id: 999 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);

    const result = await new VendreProductLiveFactsClient().getFacts([
      requestProduct('123'),
      requestProduct('456'),
    ]);

    expect(result.ok).toBe(false);
    expect(result.facts).toEqual([]);
    expect(result.missingProductIds).toEqual(['123', '456']);
    expect(result.error).toBe('product_live_facts_upstream_error');
  });
});
