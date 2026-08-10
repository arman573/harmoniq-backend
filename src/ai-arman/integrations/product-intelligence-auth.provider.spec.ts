import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';

const originalFetch = global.fetch;

describe('ProductIntelligenceAuthProvider', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps authentication disabled by default without a metadata call', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ProductIntelligenceAuthProvider().getHeaders({});

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      mode: 'none',
      headers: {},
    });
  });

  it.each([
    '',
    'http://harmoniq-product-intelligence.example.test',
    'not-a-url',
    'https://user:pass@harmoniq-product-intelligence.example.test',
    'https://harmoniq-product-intelligence.example.test/path',
    'https://harmoniq-product-intelligence.example.test/?query=1',
  ])('fails closed for an invalid private-service audience', async (audience) => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ProductIntelligenceAuthProvider().getHeaders({
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
      PRODUCT_INTELLIGENCE_AUDIENCE: audience,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      mode: 'google_metadata_identity_token',
      error: 'product_intelligence_auth_not_configured',
    });
  });

  it('rejects unknown authentication modes before any network call', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await new ProductIntelligenceAuthProvider().getHeaders({
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'bearer_secret',
      PRODUCT_INTELLIGENCE_AUDIENCE:
        'https://harmoniq-product-intelligence.example.test/',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      mode: 'invalid',
      error: 'product_intelligence_auth_not_configured',
    });
  });

  it('fetches a Google identity token from the fixed metadata endpoint', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('header.payload.signature', { status: 200 }),
    );

    const result = await new ProductIntelligenceAuthProvider().getHeaders({
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
      PRODUCT_INTELLIGENCE_AUDIENCE:
        'https://harmoniq-product-intelligence.example.test/',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=https%3A%2F%2Fharmoniq-product-intelligence.example.test',
    );
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'error',
      headers: {
        'Metadata-Flavor': 'Google',
      },
    });
    expect(result).toEqual({
      ok: true,
      mode: 'google_metadata_identity_token',
      headers: {
        Authorization: 'Bearer header.payload.signature',
      },
    });
  });

  it.each([
    new Response('not-a-jwt', { status: 200 }),
    new Response('metadata unavailable', { status: 500 }),
  ])('fails closed when metadata cannot provide a valid identity token', async (response) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response);

    const result = await new ProductIntelligenceAuthProvider().getHeaders({
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
      PRODUCT_INTELLIGENCE_AUDIENCE:
        'https://harmoniq-product-intelligence.example.test/',
    });

    expect(result).toEqual({
      ok: false,
      mode: 'google_metadata_identity_token',
      error: 'product_intelligence_auth_failed',
    });
  });
});
