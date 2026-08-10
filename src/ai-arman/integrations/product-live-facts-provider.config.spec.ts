import { readProductLiveFactsProviderConfig } from './product-live-facts-provider.config';

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    ...values,
  };
}

describe('readProductLiveFactsProviderConfig', () => {
  it('defaults to disabled with no activation inputs', () => {
    expect(readProductLiveFactsProviderConfig(env())).toEqual({
      requestedProvider: 'disabled',
      explicitlyEnabled: false,
      credentialsConfigured: false,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'default_disabled',
    });
  });

  it('does not allow Vendre when only the provider is requested', () => {
    expect(
      readProductLiveFactsProviderConfig(
        env({ AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER: 'vendre' }),
      ),
    ).toMatchObject({
      requestedProvider: 'vendre',
      explicitlyEnabled: false,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'explicit_enable_required',
    });
  });

  it('does not allow Vendre when provider and enable flag exist without credentials', () => {
    expect(
      readProductLiveFactsProviderConfig(
        env({
          AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER: 'vendre',
          AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED: 'true',
        }),
      ),
    ).toMatchObject({
      requestedProvider: 'vendre',
      explicitlyEnabled: true,
      credentialsConfigured: false,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'vendre_configuration_required',
    });
  });

  it('does not allow credentials alone to activate Vendre', () => {
    expect(
      readProductLiveFactsProviderConfig(
        env({
          VENDRE_API_BASE_URL: 'https://www.harmoniq.se',
          VENDRE_API_KEY: 'secret-placeholder',
        }),
      ),
    ).toMatchObject({
      requestedProvider: 'disabled',
      explicitlyEnabled: false,
      credentialsConfigured: true,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'default_disabled',
    });
  });

  it('does not allow an unknown provider even with enable flag and credentials', () => {
    expect(
      readProductLiveFactsProviderConfig(
        env({
          AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER: 'other',
          AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED: 'true',
          VENDRE_API_BASE_URL: 'https://www.harmoniq.se',
          VENDRE_API_KEY: 'secret-placeholder',
        }),
      ),
    ).toMatchObject({
      requestedProvider: 'disabled',
      explicitlyEnabled: true,
      credentialsConfigured: true,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'provider_not_vendre',
    });
  });

  it.each([
    'http://www.harmoniq.se',
    'not-a-url',
    'https://user:pass@www.harmoniq.se',
  ])('treats an unsafe Vendre base URL as missing configuration', (baseUrl) => {
    expect(
      readProductLiveFactsProviderConfig(
        env({
          AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER: 'vendre',
          AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED: 'true',
          VENDRE_API_BASE_URL: baseUrl,
          VENDRE_API_KEY: 'secret-placeholder',
        }),
      ),
    ).toEqual({
      requestedProvider: 'vendre',
      explicitlyEnabled: true,
      credentialsConfigured: false,
      activationAllowed: false,
      activeProvider: 'disabled',
      reason: 'vendre_configuration_required',
    });
  });

  it('allows Vendre only with explicit provider, enable flag and safe configuration', () => {
    expect(
      readProductLiveFactsProviderConfig(
        env({
          AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER: 'vendre',
          AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED: 'true',
          VENDRE_API_BASE_URL: 'https://www.harmoniq.se',
          VENDRE_API_KEY: 'secret-placeholder',
        }),
      ),
    ).toEqual({
      requestedProvider: 'vendre',
      explicitlyEnabled: true,
      credentialsConfigured: true,
      activationAllowed: true,
      activeProvider: 'vendre',
      reason: 'vendre_activation_allowed',
    });
  });
});
