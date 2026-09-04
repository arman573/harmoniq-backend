export type TrackingReadConfigReason =
  | 'default_disabled'
  | 'explicit_enable_required'
  | 'tracking_configuration_required'
  | 'tracking_read_allowed';

export type TrackingReadConfig = {
  enabled: boolean;
  baseUrl: string | null;
  activationAllowed: boolean;
  reason: TrackingReadConfigReason;
};

export function normalizeTrackingReadBaseUrl(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.search || url.hash) return null;
    if (url.pathname !== '/') return null;

    return url.origin;
  } catch {
    return null;
  }
}

export function readTrackingReadConfig(
  env: NodeJS.ProcessEnv = process.env,
): TrackingReadConfig {
  const rawEnabled = env.AI_ARMAN_TRACKING_READ_ENABLED;
  const enabled = rawEnabled === 'true';
  const baseUrl = normalizeTrackingReadBaseUrl(
    env.AI_ARMAN_TRACKING_READ_BASE_URL,
  );

  if (!enabled) {
    return {
      enabled: false,
      baseUrl,
      activationAllowed: false,
      reason:
        rawEnabled === undefined || rawEnabled === ''
          ? 'default_disabled'
          : 'explicit_enable_required',
    };
  }

  if (!baseUrl) {
    return {
      enabled: true,
      baseUrl: null,
      activationAllowed: false,
      reason: 'tracking_configuration_required',
    };
  }

  return {
    enabled: true,
    baseUrl,
    activationAllowed: true,
    reason: 'tracking_read_allowed',
  };
}
