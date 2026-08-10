import { normalizeVendreHttpsBaseUrl } from './vendre-base-url.policy';

export type ProductLiveFactsProviderName = 'disabled' | 'vendre';

export type ProductLiveFactsProviderConfig = {
  requestedProvider: ProductLiveFactsProviderName;
  explicitlyEnabled: boolean;
  credentialsConfigured: boolean;
  activationAllowed: boolean;
  activeProvider: ProductLiveFactsProviderName;
  reason:
    | 'default_disabled'
    | 'provider_not_vendre'
    | 'explicit_enable_required'
    | 'vendre_configuration_required'
    | 'vendre_activation_allowed';
};

export function readProductLiveFactsProviderConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductLiveFactsProviderConfig {
  const rawProvider = String(env.AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER || '')
    .trim()
    .toLowerCase();
  const requestedProvider: ProductLiveFactsProviderName =
    rawProvider === 'vendre' ? 'vendre' : 'disabled';
  const explicitlyEnabled =
    String(env.AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED || '')
      .trim()
      .toLowerCase() === 'true';
  const credentialsConfigured = Boolean(
    normalizeVendreHttpsBaseUrl(env.VENDRE_API_BASE_URL) &&
      String(env.VENDRE_API_KEY || '').trim(),
  );

  if (!rawProvider) {
    return disabledConfig(
      requestedProvider,
      explicitlyEnabled,
      credentialsConfigured,
      'default_disabled',
    );
  }

  if (requestedProvider !== 'vendre') {
    return disabledConfig(
      requestedProvider,
      explicitlyEnabled,
      credentialsConfigured,
      'provider_not_vendre',
    );
  }

  if (!explicitlyEnabled) {
    return disabledConfig(
      requestedProvider,
      explicitlyEnabled,
      credentialsConfigured,
      'explicit_enable_required',
    );
  }

  if (!credentialsConfigured) {
    return disabledConfig(
      requestedProvider,
      explicitlyEnabled,
      credentialsConfigured,
      'vendre_configuration_required',
    );
  }

  return {
    requestedProvider,
    explicitlyEnabled,
    credentialsConfigured,
    activationAllowed: true,
    activeProvider: 'vendre',
    reason: 'vendre_activation_allowed',
  };
}

function disabledConfig(
  requestedProvider: ProductLiveFactsProviderName,
  explicitlyEnabled: boolean,
  credentialsConfigured: boolean,
  reason: Exclude<
    ProductLiveFactsProviderConfig['reason'],
    'vendre_activation_allowed'
  >,
): ProductLiveFactsProviderConfig {
  return {
    requestedProvider,
    explicitlyEnabled,
    credentialsConfigured,
    activationAllowed: false,
    activeProvider: 'disabled',
    reason,
  };
}
