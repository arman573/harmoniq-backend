const DEFAULT_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 15000;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

export type ReturnsModuleReadConfig =
  | {
      ok: true;
      baseUrl: string;
      accessToken: string;
      timeoutMs: number;
    }
  | {
      ok: false;
      error:
        | 'returns_module_read_disabled'
        | 'returns_module_base_url_not_configured'
        | 'returns_module_base_url_invalid'
        | 'returns_module_access_token_not_configured';
    };

export function isReturnsModuleReadEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env.AI_ARMAN_RETURNS_MODULE_READ_ENABLED || '')
    .trim()
    .toLowerCase() === 'true';
}

export function readReturnsModuleReadConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReturnsModuleReadConfig {
  if (!isReturnsModuleReadEnabled(env)) {
    return { ok: false, error: 'returns_module_read_disabled' };
  }

  const rawBaseUrl = String(env.AI_ARMAN_RETURNS_MODULE_BASE_URL || '').trim();
  if (!rawBaseUrl) {
    return { ok: false, error: 'returns_module_base_url_not_configured' };
  }

  const baseUrl = normalizeReturnsModuleBaseUrl(rawBaseUrl);
  if (!baseUrl) {
    return { ok: false, error: 'returns_module_base_url_invalid' };
  }

  const accessToken = String(
    env.AI_ARMAN_RETURNS_MODULE_ACCESS_TOKEN || '',
  ).trim();
  if (!isSafeAccessToken(accessToken)) {
    return { ok: false, error: 'returns_module_access_token_not_configured' };
  }

  return {
    ok: true,
    baseUrl,
    accessToken,
    timeoutMs: normalizeTimeout(env.AI_ARMAN_RETURNS_MODULE_TIMEOUT_MS),
  };
}

export function normalizeReturnsModuleBaseUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password || url.search || url.hash) {
      return null;
    }
    if (url.pathname && url.pathname !== '/') return null;

    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function isSafeAccessToken(value: string): boolean {
  if (value.length < MIN_TOKEN_LENGTH || value.length > MAX_TOKEN_LENGTH) {
    return false;
  }

  return !/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\s]/.test(
    value,
  );
}

function normalizeTimeout(value: unknown): number {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, Math.trunc(configured)),
  );
}
