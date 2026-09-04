import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';
import { ProductIntelligenceClient } from './product-intelligence.client';
import type {
  ProductIntelligenceAuditRecord,
  ProductIntelligenceAuditSink,
} from './product-intelligence-observability.store';

const originalEnv = {
  baseUrl: process.env.PRODUCT_INTELLIGENCE_BASE_URL,
  authMode: process.env.PRODUCT_INTELLIGENCE_AUTH_MODE,
  audience: process.env.PRODUCT_INTELLIGENCE_AUDIENCE,
};

describe('ProductIntelligenceClient URL boundary', () => {
  afterEach(() => {
    restoreEnv('PRODUCT_INTELLIGENCE_BASE_URL', originalEnv.baseUrl);
    restoreEnv('PRODUCT_INTELLIGENCE_AUTH_MODE', originalEnv.authMode);
    restoreEnv('PRODUCT_INTELLIGENCE_AUDIENCE', originalEnv.audience);
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

  it('fails closed before auth or PI network for an invalid outbound request', async () => {
    process.env.PRODUCT_INTELLIGENCE_BASE_URL =
      'https://candidate---service.example.test';
    process.env.PRODUCT_INTELLIGENCE_AUTH_MODE =
      'google_metadata_identity_token';
    process.env.PRODUCT_INTELLIGENCE_AUDIENCE =
      'https://service.example.test';

    const authProvider = {
      getHeaders: jest.fn(),
    } as unknown as ProductIntelligenceAuthProvider;
    const records: ProductIntelligenceAuditRecord[] = [];
    const auditSink = {
      record: jest.fn((record: ProductIntelligenceAuditRecord) => {
        records.push(record);
      }),
    } as ProductIntelligenceAuditSink;
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ProductIntelligenceClient(
      authProvider,
      auditSink,
    ).evaluate('ok', [{ productId: 'p1', title: 'Test Shampoo' }]);

    expect(authProvider.getHeaders).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      configured: true,
      durationMs: 0,
      analyses: [],
      error: 'product_intelligence_request_invalid',
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: 'request_invalid',
      authMode: 'google_metadata_identity_token',
      durationMs: 0,
      upstreamStatus: null,
    });
  });

  it('uses candidate request URL while passing canonical service audience to auth', async () => {
    process.env.PRODUCT_INTELLIGENCE_BASE_URL =
      'https://candidate---service.example.test/';
    process.env.PRODUCT_INTELLIGENCE_AUTH_MODE =
      'google_metadata_identity_token';
    process.env.PRODUCT_INTELLIGENCE_AUDIENCE =
      'https://service.example.test/';

    const getHeaders = jest.fn().mockResolvedValue({
      ok: true,
      mode: 'google_metadata_identity_token',
      headers: {
        Authorization: 'Bearer header.payload.signature',
      },
    });
    const authProvider = {
      getHeaders,
    } as unknown as ProductIntelligenceAuthProvider;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 503 }));

    const result = await new ProductIntelligenceClient(authProvider).evaluate(
      'Jag behöver ett schampo.',
      [{ productId: 'p1', title: 'Test Shampoo' }],
    );

    expect(getHeaders).toHaveBeenCalledWith({
      mode: 'google_metadata_identity_token',
      audience: 'https://service.example.test',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://candidate---service.example.test/v1/ai-arman/product-intelligence/evaluate-batch',
    );
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer header.payload.signature',
      },
    });
    expect(result).toMatchObject({
      ok: false,
      configured: true,
      upstreamStatus: 503,
      analyses: [],
      error: 'product_intelligence_upstream_error',
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
