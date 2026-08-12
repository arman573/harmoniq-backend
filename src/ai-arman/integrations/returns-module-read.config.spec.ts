import {
  normalizeReturnsModuleBaseUrl,
  readReturnsModuleReadConfig,
} from './returns-module-read.config';

describe('returns module read config', () => {
  it('is disabled by default', () => {
    expect(readReturnsModuleReadConfig({})).toEqual({
      ok: false,
      error: 'returns_module_read_disabled',
    });
  });

  it('requires https root URL and a dedicated strong token after opt-in', () => {
    expect(
      readReturnsModuleReadConfig({
        AI_ARMAN_RETURNS_MODULE_READ_ENABLED: 'true',
        AI_ARMAN_RETURNS_MODULE_BASE_URL: 'http://example.com',
        AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN: 'x'.repeat(40),
      }),
    ).toEqual({ ok: false, error: 'returns_module_base_url_invalid' });

    expect(
      readReturnsModuleReadConfig({
        AI_ARMAN_RETURNS_MODULE_READ_ENABLED: 'true',
        AI_ARMAN_RETURNS_MODULE_BASE_URL: 'https://returns.example.com/api',
        AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN: 'x'.repeat(40),
      }),
    ).toEqual({ ok: false, error: 'returns_module_base_url_invalid' });

    expect(
      readReturnsModuleReadConfig({
        AI_ARMAN_RETURNS_MODULE_READ_ENABLED: 'true',
        AI_ARMAN_RETURNS_MODULE_BASE_URL: 'https://returns.example.com',
        AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN: 'short',
      }),
    ).toEqual({
      ok: false,
      error: 'returns_module_access_token_not_configured',
    });
  });

  it('returns normalized bounded config when every explicit gate is valid', () => {
    expect(
      readReturnsModuleReadConfig({
        AI_ARMAN_RETURNS_MODULE_READ_ENABLED: 'true',
        AI_ARMAN_RETURNS_MODULE_BASE_URL: 'https://returns.example.com/',
        AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN: 'a'.repeat(64),
        AI_ARMAN_RETURNS_MODULE_TIMEOUT_MS: '999999',
      }),
    ).toEqual({
      ok: true,
      baseUrl: 'https://returns.example.com',
      accessToken: 'a'.repeat(64),
      timeoutMs: 15000,
    });
  });

  it('rejects credentials, query strings and fragments in the base URL', () => {
    expect(normalizeReturnsModuleBaseUrl('https://user:pass@example.com')).toBeNull();
    expect(normalizeReturnsModuleBaseUrl('https://example.com?x=1')).toBeNull();
    expect(normalizeReturnsModuleBaseUrl('https://example.com/#x')).toBeNull();
  });
});
