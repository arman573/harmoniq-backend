import { readReturnsAdminGatewayConfig } from './returns-admin-gateway.config';

const TOKEN = 'x'.repeat(48);

describe('readReturnsAdminGatewayConfig', () => {
  it('is disabled by default', () => {
    expect(readReturnsAdminGatewayConfig({} as NodeJS.ProcessEnv)).toEqual({
      ok: false,
      error: 'returns_admin_gateway_disabled',
    });
  });

  it('requires a private Cloud Run style base URL and token', () => {
    expect(
      readReturnsAdminGatewayConfig({
        AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED: 'true',
        AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL: 'https://example.com',
        AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN: TOKEN,
      } as NodeJS.ProcessEnv),
    ).toEqual({
      ok: false,
      error: 'returns_admin_gateway_base_url_invalid',
    });
  });

  it('resolves read enabled with writes off by default', () => {
    const result = readReturnsAdminGatewayConfig({
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED: 'true',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL:
        'https://harmoniq-returns-api-abc-lz.a.run.app',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN: TOKEN,
    } as NodeJS.ProcessEnv);

    expect(result).toMatchObject({
      ok: true,
      writeEnabled: false,
      accessToken: TOKEN,
      timeoutMs: 20_000,
    });
  });

  it('requires explicit AI-side write enable', () => {
    const result = readReturnsAdminGatewayConfig({
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED: 'true',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL:
        'https://harmoniq-returns-api-abc-lz.a.run.app',
      AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN: TOKEN,
      AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED: 'true',
    } as NodeJS.ProcessEnv);

    expect(result).toMatchObject({ ok: true, writeEnabled: true });
  });
});
