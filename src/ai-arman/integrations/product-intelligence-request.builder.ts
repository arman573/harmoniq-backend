import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  type ProductIntelligenceBatchRequest,
  type ProductIntelligenceRequestProduct,
} from './product-intelligence.types';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_PRODUCT_ID_LENGTH = 128;
const MAX_PRODUCT_TITLE_LENGTH = 300;
const MAX_PRODUCT_URL_LENGTH = 1000;
const MAX_SERIALIZED_REQUEST_BYTES = 32 * 1024;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_OR_ID_PATTERN = /\+?\d[\d\s()-]{7,}\d/g;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const NAMED_SECRET_PATTERN = /\b(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi;
const DANGEROUS_INVISIBLE_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

export function buildProductIntelligenceBatchRequest(
  message: unknown,
  products: unknown,
): ProductIntelligenceBatchRequest | null {
  const customerMessage = redactOutboundText(message);
  if (
    customerMessage.length < 3 ||
    customerMessage.length > MAX_MESSAGE_LENGTH
  ) {
    return null;
  }
  if (!Array.isArray(products) || products.length === 0 || products.length > 25) {
    return null;
  }

  const minimizedProducts: ProductIntelligenceRequestProduct[] = [];
  const productIds = new Set<string>();

  for (const value of products) {
    if (!isRecord(value)) return null;

    const productId = boundedStructuralText(
      value.productId,
      MAX_PRODUCT_ID_LENGTH,
    );
    const title = boundedStructuralText(value.title, MAX_PRODUCT_TITLE_LENGTH);
    if (!productId || !title || productIds.has(productId)) return null;
    productIds.add(productId);

    const url = minimizeProductUrl(value.url);
    minimizedProducts.push({
      productId,
      title: redactCredentialText(title),
      ...(url ? { url } : {}),
    });
  }

  const request: ProductIntelligenceBatchRequest = {
    contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
    customerNeed: {
      message: customerMessage,
    },
    products: minimizedProducts,
  };

  return Buffer.byteLength(JSON.stringify(request), 'utf8') <=
    MAX_SERIALIZED_REQUEST_BYTES
    ? request
    : null;
}

function redactOutboundText(value: unknown): string {
  return redactCredentialText(
    String(value || '')
      .normalize('NFC')
      .replace(DANGEROUS_INVISIBLE_PATTERN, ' '),
  )
    .replace(EMAIL_PATTERN, '[email]')
    .replace(PHONE_OR_ID_PATTERN, '[phone_or_id]')
    .trim();
}

function redactCredentialText(value: string): string {
  return String(value || '')
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED]')
    .replace(NAMED_SECRET_PATTERN, '$1=[REDACTED]')
    .trim();
}

function minimizeProductUrl(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return null;

  const raw = value.normalize('NFC').trim();
  if (!raw) return null;
  if (
    raw.length > MAX_PRODUCT_URL_LENGTH ||
    DANGEROUS_INVISIBLE_PATTERN.test(raw)
  ) {
    DANGEROUS_INVISIBLE_PATTERN.lastIndex = 0;
    return null;
  }
  DANGEROUS_INVISIBLE_PATTERN.lastIndex = 0;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const pathOnly = raw.split(/[?#]/, 1)[0].trim();
    return pathOnly && pathOnly.length <= MAX_PRODUCT_URL_LENGTH
      ? pathOnly
      : null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    const minimized = `${url.origin}${url.pathname}`;
    return minimized.length <= MAX_PRODUCT_URL_LENGTH ? minimized : null;
  } catch {
    return null;
  }
}

function boundedStructuralText(
  value: unknown,
  maximumLength: number,
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  if (!normalized || normalized.length > maximumLength) return null;
  if (DANGEROUS_INVISIBLE_PATTERN.test(normalized)) {
    DANGEROUS_INVISIBLE_PATTERN.lastIndex = 0;
    return null;
  }
  DANGEROUS_INVISIBLE_PATTERN.lastIndex = 0;
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
