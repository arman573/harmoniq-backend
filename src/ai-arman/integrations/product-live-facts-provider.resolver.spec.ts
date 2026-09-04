import type { ProductLiveFactsClient } from './product-live-facts.client';
import type { ProductLiveFactsProviderConfig } from './product-live-facts-provider.config';
import { resolveProductLiveFactsProvider } from './product-live-facts-provider.resolver';

function client(name: string): ProductLiveFactsClient {
  return {
    getFacts: jest.fn(async () => ({
      ok: false,
      configured: false,
      readOnly: true as const,
      source: 'not_configured' as const,
      requestedProductIds: [],
      facts: [],
      missingProductIds: [],
      error: 'product_live_facts_not_configured' as const,
    })),
    name,
  } as unknown as ProductLiveFactsClient;
}

function config(
  overrides: Partial<ProductLiveFactsProviderConfig> = {},
): ProductLiveFactsProviderConfig {
  return {
    requestedProvider: 'disabled',
    explicitlyEnabled: false,
    credentialsConfigured: false,
    activationAllowed: false,
    activeProvider: 'disabled',
    reason: 'default_disabled',
    ...overrides,
  };
}

describe('resolveProductLiveFactsProvider', () => {
  const disabled = client('disabled');
  const vendre = client('vendre');
  const providers = { disabled, vendre };

  it('returns the disabled provider for the default configuration', () => {
    const result = resolveProductLiveFactsProvider(config(), providers);

    expect(result.provider).toBe(disabled);
    expect(result.name).toBe('disabled');
    expect(result.activated).toBe(false);
    expect(result.reason).toBe('default_disabled');
  });

  it.each([
    {
      activationAllowed: false,
      activeProvider: 'disabled' as const,
      requestedProvider: 'vendre' as const,
      explicitlyEnabled: false,
      credentialsConfigured: true,
      reason: 'explicit_enable_required' as const,
    },
    {
      activationAllowed: false,
      activeProvider: 'disabled' as const,
      requestedProvider: 'vendre' as const,
      explicitlyEnabled: true,
      credentialsConfigured: false,
      reason: 'vendre_configuration_required' as const,
    },
    {
      activationAllowed: false,
      activeProvider: 'disabled' as const,
      requestedProvider: 'disabled' as const,
      explicitlyEnabled: true,
      credentialsConfigured: true,
      reason: 'provider_not_vendre' as const,
    },
  ])('fails closed for a non-activatable configuration', (overrides) => {
    const result = resolveProductLiveFactsProvider(config(overrides), providers);

    expect(result.provider).toBe(disabled);
    expect(result.name).toBe('disabled');
    expect(result.activated).toBe(false);
  });

  it('returns the Vendre provider only for the fully allowed configuration', () => {
    const result = resolveProductLiveFactsProvider(
      config({
        requestedProvider: 'vendre',
        explicitlyEnabled: true,
        credentialsConfigured: true,
        activationAllowed: true,
        activeProvider: 'vendre',
        reason: 'vendre_activation_allowed',
      }),
      providers,
    );

    expect(result.provider).toBe(vendre);
    expect(result.name).toBe('vendre');
    expect(result.activated).toBe(true);
    expect(result.reason).toBe('vendre_activation_allowed');
  });

  it('does not trust activationAllowed when the rest of the gate is inconsistent', () => {
    const result = resolveProductLiveFactsProvider(
      config({
        requestedProvider: 'vendre',
        explicitlyEnabled: false,
        credentialsConfigured: true,
        activationAllowed: true,
        activeProvider: 'vendre',
        reason: 'explicit_enable_required',
      }),
      providers,
    );

    expect(result.provider).toBe(disabled);
    expect(result.activated).toBe(false);
  });
});
