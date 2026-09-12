import { readProductIntelligenceConnectionConfig } from './product-intelligence-connection.config';

describe('Product Intelligence connection config', () => {
  it('allows a safe request origin with auth disabled', () => {
    expect(
      readProductIntelligenceConnectionConfig({
        PRODUCT_INTELLIGENCE_BASE_URL: 'https://candidate---service.example.test/',
        PRODUCT_INTELLIGENCE_AUTH_MODE: 'none',
      }),
    ).toEqual({
      ok: true,
      baseUrl: 'https://candidate---service.example.test',
      auth: {
        mode: 'none',
        audience: null,
      },
    });
  });

  it('allows a candidate request origin with a separate canonical audience', () => {
    expect(
      readProductIntelligenceConnectionConfig({
        PRODUCT_INTELLIGENCE_BASE_URL: 'https://candidate---service.example.test',
        PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
        PRODUCT_INTELLIGENCE_AUDIENCE: 'https://service.example.test/',
      }),
    ).toEqual({
      ok: true,
      baseUrl: 'https://candidate---service.example.test',
      auth: {
        mode: 'google_metadata_identity_token',
        audience: 'https://service.example.test',
      },
    });
  });

  it.each([
    {},
    { PRODUCT_INTELLIGENCE_BASE_URL: 'http://service.example.test' },
    { PRODUCT_INTELLIGENCE_BASE_URL: 'https://service.example.test/path' },
  ])('fails closed when the request base URL is not safely configured', (env) => {
    expect(readProductIntelligenceConnectionConfig(env)).toEqual({
      ok: false,
      error: 'product_intelligence_not_configured',
    });
  });

  it.each([
    {
      PRODUCT_INTELLIGENCE_BASE_URL: 'https://candidate---service.example.test',
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
    },
    {
      PRODUCT_INTELLIGENCE_BASE_URL: 'https://candidate---service.example.test',
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'google_metadata_identity_token',
      PRODUCT_INTELLIGENCE_AUDIENCE: 'http://service.example.test',
    },
    {
      PRODUCT_INTELLIGENCE_BASE_URL: 'https://candidate---service.example.test',
      PRODUCT_INTELLIGENCE_AUTH_MODE: 'unknown_mode',
      PRODUCT_INTELLIGENCE_AUDIENCE: 'https://service.example.test',
    },
  ])('fails closed when private authentication is incomplete or unsupported', (env) => {
    expect(readProductIntelligenceConnectionConfig(env)).toEqual({
      ok: false,
      error: 'product_intelligence_auth_not_configured',
    });
  });
});
