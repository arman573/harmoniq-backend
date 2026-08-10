import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';
import { ProductIntelligenceClient } from './product-intelligence.client';

const originalBaseUrl = process.env.PRODUCT_INTELLIGENCE_BASE_URL;

describe('ProductIntelligenceClient URL boundary', () => {
  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.PRODUCT_INTELLIGENCE_BASE_URL;
    } else {
      process.env.PRODUCT_INTELLIGENCE_BASE_URL = originalBaseUrl;
    }
    jest.restoreAllMocks();
  });

  it.each([
    '',
    'not-a-url',
    'http://service.example.test',
    'https://user:pass@service.example.test',
    'https://service.example.test/path',
    'https://service.example.test/?query=1',
    'https://service.example.test/#fragment',
  ])('fails closed before auth or PI network for unsafe base URL: %s', async (baseUrl) => {
    process.env.PRODUCT_INTELLIGENCE_BASE_URL = baseUrl;
    const authProvider = {
      getHeaders: jest.fn(),
    } as unknown as ProductIntelligenceAuthProvider;
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ProductIntelligenceClient(authProvider).evaluate(
      'Jag behöver ett schampo.',
      [{ productId: 'p1', title: 'Test Shampoo' }],
    );

    expect(authProvider.getHeaders).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      configured: false,
      durationMs: 0,
      analyses: [],
      error: 'product_intelligence_not_configured',
    });
  });
});
