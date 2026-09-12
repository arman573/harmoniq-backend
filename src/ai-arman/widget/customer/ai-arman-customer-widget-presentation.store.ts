import { Injectable } from '@nestjs/common';
import {
  AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
  type AiArmanCustomerWidgetActionId,
  type AiArmanCustomerWidgetPresentationV1,
} from './ai-arman-customer-widget.presentation';

export const AI_ARMAN_CUSTOMER_PRESENTATION_GCS_BUCKET_ENV =
  'AI_ARMAN_CUSTOMER_PRESENTATION_GCS_BUCKET';
export const AI_ARMAN_CUSTOMER_PRESENTATION_GCS_OBJECT_ENV =
  'AI_ARMAN_CUSTOMER_PRESENTATION_GCS_OBJECT';

const PRESENTATION_ENVELOPE_VERSION =
  'ai-arman-customer-presentation-config-v1';
const DEFAULT_PRESENTATION_OBJECT = 'ai-arman/customer-presentation-v1.json';
const MAX_STORED_BYTES = 128_000;
const TOKEN_REFRESH_SKEW_MS = 60 * 1000;
const DEFAULT_ACTION_IDS = AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION.actionCards.map(
  (item) => item.id,
);
const DEFAULT_CATEGORY_HREFS =
  AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION.categories.map((item) => item.href);

type PresentationEnvelope = {
  version: typeof PRESENTATION_ENVELOPE_VERSION;
  updatedAt: string;
  updatedBy: string;
  presentation: AiArmanCustomerWidgetPresentationV1;
};

export type AiArmanCustomerWidgetPresentationSnapshot = {
  configured: boolean;
  source: 'default' | 'gcs';
  generation: string;
  presentation: AiArmanCustomerWidgetPresentationV1;
  updatedAt?: string;
  updatedBy?: string;
};

let metadataTokenCache: { token: string; expiresAt: number } | null = null;

@Injectable()
export class AiArmanCustomerWidgetPresentationStore {
  async read(
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<AiArmanCustomerWidgetPresentationSnapshot> {
    const config = storageConfig(env);
    if (!config) return defaultSnapshot(false);

    const token = await metadataAccessToken();
    const metadataUrl = objectMetadataUrl(config);
    const metadataResponse = await fetch(metadataUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (metadataResponse.status === 404) return defaultSnapshot(true);
    if (!metadataResponse.ok) {
      throw new Error('customer_presentation_metadata_read_failed');
    }

    const metadata = (await metadataResponse.json()) as { generation?: string };
    const generation = String(metadata.generation || '').trim();
    if (!generation) {
      throw new Error('customer_presentation_generation_missing');
    }

    const mediaResponse = await fetch(`${metadataUrl}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mediaResponse.ok) {
      throw new Error('customer_presentation_read_failed');
    }

    const text = await mediaResponse.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_STORED_BYTES) {
      throw new Error('customer_presentation_too_large');
    }

    const envelope = parseEnvelope(text);
    return {
      configured: true,
      source: 'gcs',
      generation,
      presentation: envelope.presentation,
      updatedAt: envelope.updatedAt,
      updatedBy: envelope.updatedBy,
    };
  }

  async readForWidget(
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<AiArmanCustomerWidgetPresentationV1> {
    try {
      return (await this.read(env)).presentation;
    } catch (error) {
      console.warn(
        '[ai_arman_customer_presentation_fallback]',
        error instanceof Error ? error.message : 'unknown_error',
      );
      return AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION;
    }
  }

  async save(
    input: {
      presentation: unknown;
      expectedGeneration: unknown;
      updatedBy?: unknown;
    },
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<AiArmanCustomerWidgetPresentationSnapshot> {
    const config = storageConfig(env);
    if (!config) {
      throw new Error('customer_presentation_storage_not_configured');
    }

    const expectedGeneration = normalizeGeneration(input.expectedGeneration);
    if (!expectedGeneration) {
      throw new Error('customer_presentation_generation_invalid');
    }

    const presentation = normalizeAiArmanCustomerWidgetPresentation(
      input.presentation,
    );
    const updatedAt = new Date().toISOString();
    const updatedBy = cleanString(input.updatedBy || 'returns-admin', 120);
    if (!updatedBy) {
      throw new Error('customer_presentation_updated_by_invalid');
    }

    const envelope: PresentationEnvelope = {
      version: PRESENTATION_ENVELOPE_VERSION,
      updatedAt,
      updatedBy,
      presentation,
    };
    const body = JSON.stringify(envelope);
    if (Buffer.byteLength(body, 'utf8') > MAX_STORED_BYTES) {
      throw new Error('customer_presentation_too_large');
    }

    const token = await metadataAccessToken();
    const query = new URLSearchParams({
      uploadType: 'media',
      name: config.object,
      ifGenerationMatch: expectedGeneration,
    });
    const response = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
        config.bucket,
      )}/o?${query.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body,
      },
    );

    if (response.status === 412) {
      throw new Error('customer_presentation_conflict');
    }
    if (!response.ok) {
      throw new Error('customer_presentation_write_failed');
    }

    const saved = (await response.json().catch(() => ({}))) as {
      generation?: string;
    };
    const generation = String(saved.generation || '').trim();
    if (!generation) {
      throw new Error('customer_presentation_generation_missing');
    }

    return {
      configured: true,
      source: 'gcs',
      generation,
      presentation,
      updatedAt,
      updatedBy,
    };
  }
}

export function normalizeAiArmanCustomerWidgetPresentation(
  value: unknown,
): AiArmanCustomerWidgetPresentationV1 {
  if (!isRecord(value)) throw invalidPresentation();
  if (value.contractVersion !== 'ai-arman-customer-ui-v1') {
    throw invalidPresentation();
  }

  const actionCards = normalizeActionCards(value.actionCards);
  const categories = normalizeCategories(value.categories);
  const quickPrompts = normalizeQuickPrompts(value.quickPrompts);
  const avatarUrl = normalizeAvatarUrl(value.avatarUrl);

  return {
    contractVersion: 'ai-arman-customer-ui-v1',
    assistantName: requiredString(value.assistantName, 80),
    assistantSubtitle: requiredString(value.assistantSubtitle, 160),
    statusIdle: requiredString(value.statusIdle, 120),
    statusVerified: requiredString(value.statusVerified, 120),
    launcherLabel: requiredString(value.launcherLabel, 120),
    welcomeTitle: requiredString(value.welcomeTitle, 240),
    welcomeText: requiredString(value.welcomeText, 600),
    categoryTitle: requiredString(value.categoryTitle, 180),
    categoryText: requiredString(value.categoryText, 400),
    identityTitle: requiredString(value.identityTitle, 240),
    identityText: requiredString(value.identityText, 600),
    verifiedWelcome: requiredString(value.verifiedWelcome, 400),
    composerPlaceholder: requiredString(value.composerPlaceholder, 180),
    privacyText: requiredString(value.privacyText, 800),
    humanSupportLabel: requiredString(value.humanSupportLabel, 120),
    humanSupportUrl: normalizeSupportUrl(value.humanSupportUrl),
    actionCards,
    categories,
    quickPrompts,
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

function normalizeActionCards(value: unknown) {
  if (!Array.isArray(value) || value.length !== DEFAULT_ACTION_IDS.length) {
    throw invalidPresentation();
  }

  const byId = new Map<AiArmanCustomerWidgetActionId, Record<string, unknown>>();
  for (const item of value) {
    if (!isRecord(item)) throw invalidPresentation();
    const id = String(item.id || '') as AiArmanCustomerWidgetActionId;
    if (!DEFAULT_ACTION_IDS.includes(id) || byId.has(id)) {
      throw invalidPresentation();
    }
    byId.set(id, item);
  }

  return DEFAULT_ACTION_IDS.map((id) => {
    const item = byId.get(id);
    if (!item) throw invalidPresentation();
    const prompt = optionalString(item.prompt, 240);
    return {
      id,
      label: requiredString(item.label, 80),
      description: requiredString(item.description, 280),
      ...(prompt ? { prompt } : {}),
    };
  });
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value) || value.length !== DEFAULT_CATEGORY_HREFS.length) {
    throw invalidPresentation();
  }

  const byHref = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    if (!isRecord(item)) throw invalidPresentation();
    const href = String(item.href || '').trim();
    if (!DEFAULT_CATEGORY_HREFS.includes(href) || byHref.has(href)) {
      throw invalidPresentation();
    }
    byHref.set(href, item);
  }

  return DEFAULT_CATEGORY_HREFS.map((href) => {
    const item = byHref.get(href);
    if (!item) throw invalidPresentation();
    return {
      label: requiredString(item.label, 80),
      href,
      mark: requiredString(item.mark, 32),
    };
  });
}

function normalizeQuickPrompts(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw invalidPresentation();
  }

  const prompts = value.map((item) => requiredString(item, 240));
  if (new Set(prompts).size !== prompts.length) throw invalidPresentation();
  return prompts;
}

function normalizeSupportUrl(value: unknown): string {
  const raw = requiredString(value, 500);
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  try {
    const url = new URL(raw);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'harmoniq.se' || url.hostname === 'www.harmoniq.se')
    ) {
      return url.toString();
    }
  } catch {
    // handled below
  }

  throw invalidPresentation();
}

function normalizeAvatarUrl(value: unknown): string {
  const raw = optionalString(value, 100_000);
  if (!raw) return '';
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url.toString();
  } catch {
    // handled below
  }

  throw invalidPresentation();
}

function parseEnvelope(text: string): PresentationEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('customer_presentation_store_invalid');
  }
  if (!isRecord(value) || value.version !== PRESENTATION_ENVELOPE_VERSION) {
    throw new Error('customer_presentation_store_invalid');
  }

  const updatedAt = cleanString(value.updatedAt, 64);
  const updatedBy = cleanString(value.updatedBy, 120);
  if (!updatedAt || !updatedBy) {
    throw new Error('customer_presentation_store_invalid');
  }

  return {
    version: PRESENTATION_ENVELOPE_VERSION,
    updatedAt,
    updatedBy,
    presentation: normalizeAiArmanCustomerWidgetPresentation(value.presentation),
  };
}

function defaultSnapshot(
  configured: boolean,
): AiArmanCustomerWidgetPresentationSnapshot {
  return {
    configured,
    source: 'default',
    generation: '0',
    presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
  };
}

function storageConfig(env: NodeJS.ProcessEnv) {
  const bucket = String(env[AI_ARMAN_CUSTOMER_PRESENTATION_GCS_BUCKET_ENV] || '')
    .trim();
  if (!bucket) return null;
  const object = String(
    env[AI_ARMAN_CUSTOMER_PRESENTATION_GCS_OBJECT_ENV] ||
      DEFAULT_PRESENTATION_OBJECT,
  ).trim();
  if (!object) return null;
  return { bucket, object };
}

function objectMetadataUrl(config: { bucket: string; object: string }) {
  return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
    config.bucket,
  )}/o/${encodeURIComponent(config.object)}`;
}

async function metadataAccessToken(): Promise<string> {
  const now = Date.now();
  if (metadataTokenCache && metadataTokenCache.expiresAt - TOKEN_REFRESH_SKEW_MS > now) {
    return metadataTokenCache.token;
  }

  const response = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } },
  );
  if (!response.ok) throw new Error('customer_presentation_identity_unavailable');
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  const token = String(body.access_token || '').trim();
  if (!token) throw new Error('customer_presentation_identity_unavailable');

  const expiresInSeconds = Number(body.expires_in);
  const lifetimeMs =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 5 * 60 * 1000;
  metadataTokenCache = { token, expiresAt: now + lifetimeMs };
  return token;
}

function normalizeGeneration(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) ? normalized : '';
}

function requiredString(value: unknown, maxLength: number): string {
  const normalized = cleanString(value, maxLength);
  if (!normalized) throw invalidPresentation();
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string {
  if (value === undefined || value === null || value === '') return '';
  return cleanString(value, maxLength);
}

function cleanString(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function invalidPresentation(): Error {
  return new Error('customer_presentation_invalid');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
