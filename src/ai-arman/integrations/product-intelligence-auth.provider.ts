import { Injectable } from '@nestjs/common';

export type ProductIntelligenceAuthMode =
  | 'none'
  | 'google_metadata_identity_token';

export type ProductIntelligenceAuthResult =
  | {
      ok: true;
      mode: ProductIntelligenceAuthMode;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      mode: ProductIntelligenceAuthMode | 'invalid';
      error:
        | 'product_intelligence_auth_not_configured'
        | 'product_intelligence_auth_failed';
    };

const METADATA_IDENTITY_ENDPOINT =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
const DEFAULT_AUTH_TIMEOUT_MS = 800;

@Injectable()
export class ProductIntelligenceAuthProvider {
  async getHeaders(
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<ProductIntelligenceAuthResult> {
    const rawMode = String(env.PRODUCT_INTELLIGENCE_AUTH_MODE || '')
      .trim()
      .toLowerCase();

    if (!rawMode || rawMode === 'none') {
      return {
        ok: true,
        mode: 'none',
        headers: {},
      };
    }

    if (rawMode !== 'google_metadata_identity_token') {
      return {
        ok: false,
        mode: 'invalid',
        error: 'product_intelligence_auth_not_configured',
      };
    }

    const audience = normalizeAudience(env.PRODUCT_INTELLIGENCE_AUDIENCE);
    if (!audience) {
      return {
        ok: false,
        mode: 'google_metadata_identity_token',
        error: 'product_intelligence_auth_not_configured',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      readAuthTimeout(env.PRODUCT_INTELLIGENCE_AUTH_TIMEOUT_MS),
    );

    try {
      const metadataUrl = new URL(METADATA_IDENTITY_ENDPOINT);
      metadataUrl.searchParams.set('audience', audience);

      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          mode: 'google_metadata_identity_token',
          error: 'product_intelligence_auth_failed',
        };
      }

      const token = (await response.text()).trim();
      if (!looksLikeJwt(token)) {
        return {
          ok: false,
          mode: 'google_metadata_identity_token',
          error: 'product_intelligence_auth_failed',
        };
      }

      return {
        ok: true,
        mode: 'google_metadata_identity_token',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    } catch {
      return {
        ok: false,
        mode: 'google_metadata_identity_token',
        error: 'product_intelligence_auth_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeAudience(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    if (url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return `${url.origin}/`;
  } catch {
    return null;
  }
}

function readAuthTimeout(value: unknown): number {
  const configured = Number(value);
  if (!Number.isFinite(configured)) return DEFAULT_AUTH_TIMEOUT_MS;
  return Math.min(2000, Math.max(200, configured));
}

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}
