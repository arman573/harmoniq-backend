import type { ProductLiveFactsClient } from './product-live-facts.client';
import type {
  ProductLiveFactsProviderConfig,
  ProductLiveFactsProviderName,
} from './product-live-facts-provider.config';

export type ProductLiveFactsProviders = {
  disabled: ProductLiveFactsClient;
  vendre: ProductLiveFactsClient;
};

export type ResolvedProductLiveFactsProvider = {
  provider: ProductLiveFactsClient;
  name: ProductLiveFactsProviderName;
  activated: boolean;
  reason: ProductLiveFactsProviderConfig['reason'];
};

export function resolveProductLiveFactsProvider(
  config: ProductLiveFactsProviderConfig,
  providers: ProductLiveFactsProviders,
): ResolvedProductLiveFactsProvider {
  if (
    config.activationAllowed === true &&
    config.activeProvider === 'vendre' &&
    config.requestedProvider === 'vendre' &&
    config.explicitlyEnabled === true &&
    config.credentialsConfigured === true &&
    config.reason === 'vendre_activation_allowed'
  ) {
    return {
      provider: providers.vendre,
      name: 'vendre',
      activated: true,
      reason: config.reason,
    };
  }

  return {
    provider: providers.disabled,
    name: 'disabled',
    activated: false,
    reason: config.reason,
  };
}
