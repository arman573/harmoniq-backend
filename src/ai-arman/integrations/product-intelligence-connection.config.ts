import {
  normalizeProductIntelligenceAudience,
  normalizeProductIntelligenceRequestBaseUrl,
} from './product-intelligence-url.policy';

export type ProductIntelligenceAuthMode =
  | 'none'
  | 'google_metadata_identity_token';

export type ProductIntelligenceResolvedAuthConfig =
  | {
      mode: 'none';
      audience: null;
    }
  | {
      mode: 'google_metadata_identity_token';
      audience: string;
    };

export type ProductIntelligenceConnectionConfig =
  | {
      ok: true;
      baseUrl: string;
      auth: ProductIntelligenceResolvedAuthConfig;
    }
  | {
      ok: false;
      error:
        | 'product_intelligence_not_configured'
        | 'product_intelligence_auth_not_configured';
    };

export function readProductIntelligenceConnectionConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProductIntelligenceConnectionConfig {
  const baseUrl = normalizeProductIntelligenceRequestBaseUrl(
    env.PRODUCT_INTELLIGENCE_BASE_URL,
  );
  if (!baseUrl) {
    return {
      ok: false,
      error: 'product_intelligence_not_configured',
    };
  }

  const rawAuthMode = String(env.PRODUCT_INTELLIGENCE_AUTH_MODE || '')
    .trim()
    .toLowerCase();

  if (!rawAuthMode || rawAuthMode === 'none') {
    return {
      ok: true,
      baseUrl,
      auth: {
        mode: 'none',
        audience: null,
      },
    };
  }

  if (rawAuthMode !== 'google_metadata_identity_token') {
    return {
      ok: false,
      error: 'product_intelligence_auth_not_configured',
    };
  }

  const audience = normalizeProductIntelligenceAudience(
    env.PRODUCT_INTELLIGENCE_AUDIENCE,
  );
  if (!audience) {
    return {
      ok: false,
      error: 'product_intelligence_auth_not_configured',
    };
  }

  return {
    ok: true,
    baseUrl,
    auth: {
      mode: 'google_metadata_identity_token',
      audience,
    },
  };
}
