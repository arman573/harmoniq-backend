import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  type ProductIntelligenceBatchRequest,
  type ProductIntelligenceRequestProduct,
} from './product-intelligence.types';

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_OR_ID_PATTERN = /\+?\d[\d\s()-]{7,}\d/g;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const NAMED_SECRET_PATTERN = /\b(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi;

export function buildProductIntelligenceBatchRequest(
  message: unknown,
  products: unknown,
): ProductIntelligenceBatchRequest | null {
  const customerMessage = redactOutboundText(message);
  if (customerMessage.length < 3 || customerMessage.length > 1000) return null;
  if (!Array.isArray(products) || products.length === 0 || products.length > 25) {
    return null;
  }

  const minimizedProducts: ProductIntelligenceRequestProduct[] = [];
  const productIds = new Set<string>();

  for (const value of products) {
    if (!isRecord(value)) return null;

    const productId = requiredText(value.productId);
    const title = requiredText(value.title);
    if (!productId || !title || productIds.has(productId)) return null;
    productIds.add(productId);

    const url = minimizeProductUrl(value.url);
    minimizedProducts.push({
      productId,
      title: redactCredentialText(title),
      ...(url ? { url } : {}),
    });
  }

  return {
    contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
    customerNeed: {
      message: customerMessage,
    },
    products: minimizedProducts,
  };
}

function redactOutboundText(value: unknown): string {
  return redactCredentialText(String(value || ''))
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
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const pathOnly = raw.split(/[?#]/, 1)[0].trim();
    return pathOnly || null;
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
