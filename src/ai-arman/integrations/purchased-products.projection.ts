import type {
  SafePurchasedProduct,
  SafePurchasedProductsRead,
} from './purchased-products-read.types';

const MAX_PRODUCTS = 50;
const MAX_STRING_LENGTH = 512;

export function projectPurchasedProducts(
  body: unknown,
  expectedOrderId: string,
): SafePurchasedProductsRead | null {
  if (!isRecord(body)) return null;

  const orderId = readOrderId(body);
  if (!orderId || orderId !== expectedOrderId) return null;
  if (!Array.isArray(body.products)) return null;

  const products: SafePurchasedProduct[] = [];
  for (const item of body.products.slice(0, MAX_PRODUCTS)) {
    const product = projectProduct(item);
    if (product) products.push(product);
  }

  return { orderId, products };
}

function projectProduct(value: unknown): SafePurchasedProduct | null {
  if (!isRecord(value)) return null;

  const productId = readNullableScalar(value.product_id);
  const articleNumber = firstNullableScalar([
    value.model,
    value.article_number,
  ]);
  const title = firstString([value.name, value.product_name]);
  const quantity = readQuantity(value.quantity);
  const imageUrl = readImageUrl(value);

  if (!title || quantity === null) return null;

  return {
    productId,
    articleNumber,
    title,
    quantity,
    imageUrl,
  };
}

function readOrderId(value: Record<string, unknown>): string | null {
  return firstNullableScalar([value.id, value.order_id]);
}

function readQuantity(value: unknown): number | null {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000) {
    return null;
  }
  return quantity;
}

function readImageUrl(value: Record<string, unknown>): string | null {
  const direct = readNullableHttpsUrl(value.image_url);
  if (direct) return direct;

  if (isRecord(value.image) && isRecord(value.image.url)) {
    return (
      readNullableHttpsUrl(value.image.url.thumbnail) ||
      readNullableHttpsUrl(value.image.url.full)
    );
  }

  return null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    const parsed = readString(value);
    if (parsed) return parsed;
  }
  return null;
}

function firstNullableScalar(values: unknown[]): string | null {
  for (const value of values) {
    const parsed = readNullableScalar(value);
    if (parsed) return parsed;
  }
  return null;
}

function readNullableScalar(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > MAX_STRING_LENGTH) return null;
  return normalized;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_STRING_LENGTH) return null;
  return normalized;
}

function readNullableHttpsUrl(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
