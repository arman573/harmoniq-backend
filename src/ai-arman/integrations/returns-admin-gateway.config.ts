const DEFAULT_TIMEOUT_MS = 20_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 45_000;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

export type ReturnsAdminGatewayConfig =
  | {
      ok: true;
      baseUrl: string;
      audience: string;
      accessToken: string;
      writeEnabled: boolean;
      timeoutMs: number;
    }
  | {
      ok: false;
      error:
        | 'returns_admin_gateway_disabled'
        | 'returns_admin_gateway_base_url_invalid'
        | 'returns_admin_gateway_audience_invalid'
        | 'returns_admin_gateway_access_token_not_configured';
    };

export function readReturnsAdminGatewayConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReturnsAdminGatewayConfig {
  if (String(env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_ENABLED || '').trim().toLowerCase() !== 'true') {
    return { ok: false, error: 'returns_admin_gateway_disabled' };
  }

  const baseUrl = normalizeRunUrl(env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL);
  if (!baseUrl) {
    return { ok: false, error: 'returns_admin_gateway_base_url_invalid' };
  }

  const audience = normalizeRunUrl(
    env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_AUDIENCE || env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_BASE_URL,
  );
  if (!audience) {
    return { ok: false, error: 'returns_admin_gateway_audience_invalid' };
  }

  const accessToken = String(env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_ACCESS_TOKEN || '').trim();
  if (!isSafeToken(accessToken)) {
    return { ok: false, error: 'returns_admin_gateway_access_token_not_configured' };
  }

  return {
    ok: true,
    baseUrl,
    audience,
    accessToken,
    writeEnabled:
      String(env.AI_ARMAN_RETURNS_ADMIN_WRITE_ENABLED || '').trim().toLowerCase() === 'true',
    timeoutMs: normalizeTimeout(env.AI_ARMAN_RETURNS_ADMIN_GATEWAY_TIMEOUT_MS),
  };
}

export function normalizeRunUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.run.app')) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname && url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isSafeToken(value: string): boolean {
  if (value.length < MIN_TOKEN_LENGTH || value.length > MAX_TOKEN_LENGTH) return false;
  return !/[\u0000-\u001F\u007F\s]/.test(value);
}

function normalizeTimeout(value: unknown): number {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(configured)));
}
