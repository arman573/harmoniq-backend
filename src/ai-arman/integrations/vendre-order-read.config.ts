import { normalizeVendreHttpsBaseUrl } from './vendre-base-url.policy';

export type VendreOrderReadConfig = {
  enabled: boolean;
  baseUrl: string | null;
  apiKey: string;
  activationAllowed: boolean;
  reason:
    | 'default_disabled'
    | 'explicit_enable_required'
    | 'vendre_configuration_required'
    | 'vendre_order_read_allowed';
};

export function readVendreOrderReadConfig(
  env: NodeJS.ProcessEnv = process.env,
): VendreOrderReadConfig {
  const enabled =
    String(env.AI_ARMAN_VENDRE_ORDER_READ_ENABLED || '')
      .trim()
      .toLowerCase() === 'true';
  const baseUrl = normalizeVendreHttpsBaseUrl(env.VENDRE_API_BASE_URL);
  const apiKey = String(env.VENDRE_API_KEY || '').trim();

  if (!enabled) {
    return {
      enabled: false,
      baseUrl,
      apiKey,
      activationAllowed: false,
      reason: env.AI_ARMAN_VENDRE_ORDER_READ_ENABLED
        ? 'explicit_enable_required'
        : 'default_disabled',
    };
  }

  if (!baseUrl || !apiKey) {
    return {
      enabled: true,
      baseUrl,
      apiKey,
      activationAllowed: false,
      reason: 'vendre_configuration_required',
    };
  }

  return {
    enabled: true,
    baseUrl,
    apiKey,
    activationAllowed: true,
    reason: 'vendre_order_read_allowed',
  };
}
