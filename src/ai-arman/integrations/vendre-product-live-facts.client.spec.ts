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

describe('VendreProductLiveFactsClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalBaseUrl === undefined) delete process.env.VENDRE_API_BASE_URL;
    else process.env.VENDRE_API_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.VENDRE_API_KEY;
    else process.env.VENDRE_API_KEY = originalApiKey;
  });

  it('fails closed without Vendre configuration and makes no network call', async () => {
    delete process.env.VENDRE_API_BASE_URL;
    delete process.env.VENDRE_API_KEY;
    const fetchSpy = jest.spyOn(global, 'fetch');
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      configured: false,
      readOnly: true,
      source: 'not_configured',
      requestedProductIds: ['123'],
      facts: [],
      missingProductIds: ['123'],
      error: 'product_live_facts_not_configured',
    });
  });

  it.each([
    'http://www.harmoniq.se',
    'not-a-url',
    'https://user:pass@www.harmoniq.se',
  ])('rejects an unsafe Vendre base URL before any credentialed request', async (baseUrl) => {
    process.env.VENDRE_API_BASE_URL = baseUrl;
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      configured: false,
      readOnly: true,
      source: 'not_configured',
      requestedProductIds: ['123'],
      facts: [],
      missingProductIds: ['123'],
      error: 'product_live_facts_not_configured',
    });
  });

  it('uses GET with X-Authorization and maps verified Vendre facts', async () => {
    configureVendre();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        name: { sv: 'Produkt 123' },
        price: '100',
        quantity: '2',
        status: 1,
        show: true,
      }),
    } as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://www.harmoniq.se/API/1/products/123');
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'X-Authorization': 'test-key',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      productId: '123',
      canonicalUrl: 'https://www.harmoniq.se/produkt-123',
      title: 'Produkt 123',
      imageUrl: 'https://www.harmoniq.se/produkt-123.jpg',
      price: { amount: 125, currency: 'SEK' },
      stock: { quantity: 2, availability: 'in_stock' },
      active: true,
      visible: true,
      source: 'vendre',
    });
    expect(Number.isFinite(Date.parse(result.facts[0].fetchedAt))).toBe(true);
  });

  it('uses an active special price before adding Swedish standard VAT', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        name: { sv: 'Produkt 123' },
        price: 100,
        price_special: 80,
        price_special_date_range: null,
        quantity: 1,
        status: true,
        show: true,
      }),
    } as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(result.facts[0].price).toEqual({ amount: 100, currency: 'SEK' });
  });

  it.each([
    { from: '2099-01-01', to: null },
    { from: null, to: '2000-01-01' },
    { from: 'not-a-date', to: null },
  ])('falls back to regular price when special price range is not active', async (dateRange) => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 123,
        name: { sv: 'Produkt 123' },
        price: 100,
        price_special: 80,
        price_special_date_range: dateRange,
        quantity: 1,
        status: true,
        show: true,
      }),
    } as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(result.facts[0].price).toEqual({ amount: 125, currency: 'SEK' });
  });

  it('requires backend-owned storefront metadata instead of accepting bare ids', async () => {
    configureVendre();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const client = new VendreProductLiveFactsClient();
    const runtimeClient = client as unknown as {
      getFacts(products: unknown): ReturnType<VendreProductLiveFactsClient['getFacts']>;
    };

    const result = await runtimeClient.getFacts(['123']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('product_live_facts_invalid_request');
  });

  it('fails closed with invalid_response when Vendre product identity does not match the request', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 999,
        name: { sv: 'Fel produkt' },
        price: 100,
        quantity: 2,
        status: 1,
        show: 1,
      }),
    } as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(result.ok).toBe(false);
    expect(result.facts).toEqual([]);
    expect(result.missingProductIds).toEqual(['123']);
    expect(result.error).toBe('product_live_facts_invalid_response');
  });

  it('classifies malformed Vendre JSON as invalid_response', async () => {
    configureVendre();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('invalid json');
      },
    } as unknown as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(result.ok).toBe(false);
    expect(result.facts).toEqual([]);
    expect(result.missingProductIds).toEqual(['123']);
    expect(result.error).toBe('product_live_facts_invalid_response');
  });

  it('classifies an aborted request as a timeout and fails the lookup closed', async () => {
    configureVendre();
    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    jest.spyOn(global, 'fetch').mockRejectedValue(aborted);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([requestProduct()]);

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      source: 'vendre',
      facts: [],
      missingProductIds: ['123'],
      error: 'product_live_facts_timeout',
    });
  });

  it('keeps partial success when one product verifies and another upstream request fails', async () => {
    configureVendre();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 123,
          name: { sv: 'Produkt 123' },
          price: 100,
          quantity: 1,
          status: true,
          show: true,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response);
    const client = new VendreProductLiveFactsClient();

    const result = await client.getFacts([
      requestProduct('123'),
      requestProduct('456'),
    ]);

    expect(result.ok).toBe(true);
    expect(result.facts.map((fact) => fact.productId)).toEqual(['123']);
    expect(result.missingProductIds).toEqual(['456']);
    expect(result.error).toBeUndefined();
  });
});
