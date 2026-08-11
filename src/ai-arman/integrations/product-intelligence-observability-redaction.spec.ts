import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';
import { ProductIntelligenceClient } from './product-intelligence.client';
import type {
  ProductIntelligenceAuditRecord,
  ProductIntelligenceAuditSink,
} from './product-intelligence-observability.store';
import { PRODUCT_INTELLIGENCE_CONTRACT_VERSION } from './product-intelligence.types';

const TOKEN = 'header.payload.signature';
const originalEnv = {
  baseUrl: process.env.PRODUCT_INTELLIGENCE_BASE_URL,
  authMode: process.env.PRODUCT_INTELLIGENCE_AUTH_MODE,
  audience: process.env.PRODUCT_INTELLIGENCE_AUDIENCE,
};
const originalFetch = global.fetch;

describe('Product Intelligence observability and redaction', () => {
  beforeEach(() => {
    process.env.PRODUCT_INTELLIGENCE_BASE_URL =
      'https://candidate---service.example.test';
    process.env.PRODUCT_INTELLIGENCE_AUTH_MODE =
      'google_metadata_identity_token';
    process.env.PRODUCT_INTELLIGENCE_AUDIENCE =
      'https://service.example.test';
  });

  afterEach(() => {
    restoreEnv('PRODUCT_INTELLIGENCE_BASE_URL', originalEnv.baseUrl);
    restoreEnv('PRODUCT_INTELLIGENCE_AUTH_MODE', originalEnv.authMode);
    restoreEnv('PRODUCT_INTELLIGENCE_AUDIENCE', originalEnv.audience);
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('redacts an echoed identity token before returning or auditing PI data', async () => {
    const authProvider = {
      getHeaders: jest.fn().mockResolvedValue({
        ok: true,
        mode: 'google_metadata_identity_token',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }),
    } as unknown as ProductIntelligenceAuthProvider;

    const records: ProductIntelligenceAuditRecord[] = [];
    const auditSink = {
      record: jest.fn((record: ProductIntelligenceAuditRecord) => {
        records.push(record);
      }),
    } as ProductIntelligenceAuditSink;

    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(validResponse(`upstream echoed ${TOKEN}`)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as jest.Mock;

    const result = await new ProductIntelligenceClient(
      authProvider,
      auditSink,
    ).evaluate('fuktgivande schampo', [
      { productId: '1001', title: 'Hydrating Shampoo' },
    ]);

    expect(result.ok).toBe(true);
    expect(result.verification?.error).toBe('upstream echoed [REDACTED]');
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).not.toContain(`Bearer ${TOKEN}`);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: 'completed',
      authMode: 'google_metadata_identity_token',
      upstreamStatus: 200,
    });
    expect(JSON.stringify(records[0])).not.toContain(TOKEN);
    expect(JSON.stringify(records[0])).not.toContain('candidate---service');
    expect(JSON.stringify(records[0])).not.toContain('service.example.test');
    expect(JSON.stringify(records[0])).not.toContain('upstream echoed');
  });

  it('keeps the customer path independent when the audit sink throws', async () => {
    const authProvider = {
      getHeaders: jest.fn().mockResolvedValue({
        ok: true,
        mode: 'none',
        headers: {},
      }),
    } as unknown as ProductIntelligenceAuthProvider;
    process.env.PRODUCT_INTELLIGENCE_AUTH_MODE = 'none';
    delete process.env.PRODUCT_INTELLIGENCE_AUDIENCE;

    const auditSink = {
      record: jest.fn(() => {
        throw new Error(`must never escape ${TOKEN}`);
      }),
    } as ProductIntelligenceAuditSink;

    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(validResponse(undefined)), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as jest.Mock;

    const result = await new ProductIntelligenceClient(
      authProvider,
      auditSink,
    ).evaluate('fuktgivande schampo', [
      { productId: '1001', title: 'Hydrating Shampoo' },
    ]);

    expect(result.ok).toBe(true);
    expect(auditSink.record).toHaveBeenCalledTimes(1);
  });
});

function validResponse(error: string | undefined) {
  return {
    ok: true,
    contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
    engineVersion: 'product-intelligence-deterministic-v1',
    generatedAt: '2026-08-11T06:00:00.000Z',
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
      cost: {
        allowed: true,
        reason: 'verification_disabled',
        estimatedMaximumUsd: 0,
        requestLimitUsd: 0,
        dailyLimitUsd: 0,
        spentTodayUsd: 0,
        remainingTodayUsd: 0,
        actualUsd: 0,
        inputUsd: 0,
        cachedInputUsd: 0,
        outputUsd: 0,
        currency: 'USD',
        pricingVersion: 'gpt-5.6-luna-2026-08',
      },
      ...(error === undefined ? {} : { error }),
    },
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
