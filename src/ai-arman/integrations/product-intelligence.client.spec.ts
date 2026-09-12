import { ProductIntelligenceClient } from './product-intelligence.client';
import { PRODUCT_INTELLIGENCE_CONTRACT_VERSION } from './product-intelligence.types';

describe('ProductIntelligenceClient', () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.PRODUCT_INTELLIGENCE_BASE_URL;

  beforeEach(() => {
    process.env.PRODUCT_INTELLIGENCE_BASE_URL =
      'https://product-intelligence.example.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.PRODUCT_INTELLIGENCE_BASE_URL;
    } else {
      process.env.PRODUCT_INTELLIGENCE_BASE_URL = originalBaseUrl;
    }
  });

  it('rejects a successful upstream response without canonical verification cost data', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
          engineVersion: 'product-intelligence-deterministic-v1',
          generatedAt: '2026-08-05T08:00:00.000Z',
          analyses: [],
          verification: {
            enabled: false,
            attempted: false,
            required: false,
            reason: 'verification_disabled',
            model: 'gpt-5.6-luna',
            webSearchUsed: false,
            cacheHit: false,
            products: [],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    ) as jest.Mock;

    const result = await new ProductIntelligenceClient().evaluate(
      'fuktgivande schampo',
      [{ productId: '1001', title: 'Hydrating Shampoo' }],
    );

    expect(result).toMatchObject({
      ok: false,
      configured: true,
      analyses: [],
      upstreamStatus: 200,
      error: 'product_intelligence_contract_invalid',
    });
  });
});
