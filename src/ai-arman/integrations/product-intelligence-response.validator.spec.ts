import { ProductIntelligenceClient } from './product-intelligence.client';
import { PRODUCT_INTELLIGENCE_CONTRACT_VERSION } from './product-intelligence.types';

const originalFetch = global.fetch;
const originalBaseUrl = process.env.PRODUCT_INTELLIGENCE_BASE_URL;

function canonicalResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
    engineVersion: 'product-intelligence-deterministic-v1',
    generatedAt: '2026-08-10T16:00:00.000Z',
    analyses: [
      {
        productId: '1001',
        designation: {
          normalized: 'fuktgivande schampo',
          score: 90,
          reasons: ['Rätt produkttyp.'],
        },
        inci: {
          original: 'Aqua, Glycerin',
          suitabilityScore: 88,
          signals: ['glycerin'],
          conflicts: [],
          confidence: 0.9,
          engineVersion: 'ingredient-intelligence-v1',
          analyzedAt: '2026-08-10T15:59:00.000Z',
        },
        category: {
          score: 90,
          reasons: ['Schampo.'],
          values: ['schampo'],
        },
        tags: {
          score: 80,
          reasons: ['Fukt.'],
          values: ['fukt'],
        },
        hardBlockers: [],
        limitations: [],
        usage: [],
        specialFit: [],
        evidence: [
          {
            source: 'ingredient_intelligence',
            key: 'glycerin',
            confidence: 0.9,
          },
        ],
      },
    ],
    verification: {
      enabled: false,
      attempted: false,
      required: false,
      reason: 'verification_disabled',
      model: 'gpt-5.6-luna',
      webSearchUsed: false,
      cacheHit: false,
      products: [],
      cost: {
        allowed: false,
        reason: 'verification_disabled',
        estimatedMaximumUsd: 0,
        requestLimitUsd: 0.1,
        dailyLimitUsd: 1,
        spentTodayUsd: 0,
        remainingTodayUsd: 1,
        actualUsd: 0,
        inputUsd: 0,
        cachedInputUsd: 0,
        outputUsd: 0,
        currency: 'USD',
        pricingVersion: 'gpt-5.6-luna-2026-08',
      },
    },
    ...overrides,
  };
}

async function evaluateResponse(response: unknown) {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as jest.Mock;

  return new ProductIntelligenceClient().evaluate(
    'Jag behöver ett fuktgivande schampo',
    [{ productId: '1001', title: 'Hydrating Shampoo' }],
  );
}

function expectContractInvalid(result: Awaited<ReturnType<typeof evaluateResponse>>) {
  expect(result).toMatchObject({
    ok: false,
    configured: true,
    analyses: [],
    upstreamStatus: 200,
    error: 'product_intelligence_contract_invalid',
  });
}

describe('Product Intelligence response boundary', () => {
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

  it('accepts the canonical Product Intelligence v1 response', async () => {
    const result = await evaluateResponse(canonicalResponse());

    expect(result.ok).toBe(true);
    expect(result.analyses).toHaveLength(1);
    expect(result.analyses[0].productId).toBe('1001');
    expect(result.verification?.cost.actualUsd).toBe(0);
  });

  it('fails closed when a successful response contains a structurally invalid analysis', async () => {
    const response = canonicalResponse();
    const analyses = response.analyses as Array<Record<string, unknown>>;
    analyses[0] = {
      ...analyses[0],
      inci: {
        original: 'Aqua, Glycerin',
      },
    };

    expectContractInvalid(await evaluateResponse(response));
  });

  it('fails closed when a successful upstream response is not valid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('{not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as jest.Mock;

    const result = await new ProductIntelligenceClient().evaluate(
      'Jag behöver ett fuktgivande schampo',
      [{ productId: '1001', title: 'Hydrating Shampoo' }],
    );

    expectContractInvalid(result);
  });

  it('rejects duplicate analysis product IDs', async () => {
    const response = canonicalResponse();
    const first = (response.analyses as unknown[])[0];
    response.analyses = [first, first] as typeof response.analyses;

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects overlong evidence text', async () => {
    const response = canonicalResponse();
    const analysis = response.analyses[0] as Record<string, unknown>;
    analysis.evidence = [
      {
        source: 'ingredient_intelligence',
        key: 'glycerin',
        confidence: 0.9,
        reason: 'R'.repeat(2001),
      },
    ];

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects arrays that exceed the bounded item count', async () => {
    const response = canonicalResponse();
    const analysis = response.analyses[0] as Record<string, unknown>;
    analysis.usage = Array.from({ length: 51 }, (_, index) => `usage-${index}`);

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects dangerous invisible characters in upstream text', async () => {
    const response = canonicalResponse();
    const analysis = response.analyses[0] as Record<string, unknown>;
    const designation = analysis.designation as Record<string, unknown>;
    designation.normalized = 'fuktgivande\u202E schampo';

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects more than eight verification products', async () => {
    const response = canonicalResponse();
    const verification = response.verification as Record<string, unknown>;
    verification.products = Array.from({ length: 9 }, (_, index) => ({
      productId: `product-${index}`,
      verdict: 'supported',
      summary: 'Verifierad.',
      ingredientFindings: [],
      problemSolving: [],
      cautions: [],
      confidence: 0.9,
      recommendationAction: 'retain',
      sources: [],
      model: 'gpt-5.6-luna',
      webSearchUsed: false,
      cached: false,
    }));

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects unsafe source URLs with credentials', async () => {
    const response = canonicalResponse();
    const verification = response.verification as Record<string, unknown>;
    verification.products = [
      {
        productId: '1001',
        verdict: 'supported',
        summary: 'Verifierad.',
        ingredientFindings: [],
        problemSolving: [],
        cautions: [],
        confidence: 0.9,
        recommendationAction: 'retain',
        sources: [
          {
            url: 'https://user:password@example.test/source',
            title: 'Unsafe source',
          },
        ],
        model: 'gpt-5.6-luna',
        webSearchUsed: true,
        cached: false,
      },
    ];

    expectContractInvalid(await evaluateResponse(response));
  });

  it('rejects responses whose serialized value exceeds 256 KiB', async () => {
    const response = canonicalResponse({
      ignoredOversizedField: 'X'.repeat(260 * 1024),
    });

    expectContractInvalid(await evaluateResponse(response));
  });
});
