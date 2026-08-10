import { Injectable } from '@nestjs/common';
import {
  ProductLiveFactsClient,
  ProductLiveFactsInput,
  normalizeProductLiveFactsRequest,
} from './product-live-facts.client';
import type {
  ProductLiveFact,
  ProductLiveFactsLookupResult,
  ProductLiveFactsRequestProduct,
} from './product-live-facts.types';
import { normalizeVendreHttpsBaseUrl } from './vendre-base-url.policy';

const DEFAULT_TIMEOUT_MS = 1200;
const SWEDISH_STANDARD_VAT_RATE = 0.25;

type UnknownRecord = Record<string, unknown>;
type NonTimeoutProductLiveFactsError =
  | 'product_live_facts_upstream_error'
  | 'product_live_facts_invalid_response';

@Injectable()
export class VendreProductLiveFactsClient extends ProductLiveFactsClient {
  async getFacts(
    products: ProductLiveFactsInput,
  ): Promise<ProductLiveFactsLookupResult> {
    const requestedProducts = normalizeProductLiveFactsRequest(products);
    const requestedProductIds = requestedProducts.map((product) => product.productId);

    if (requestedProducts.length === 0) {
      return {
        ok: false,
        configured: this.isConfigured(),
        readOnly: true,
        source: this.isConfigured() ? 'vendre' : 'not_configured',
        requestedProductIds: [],
        facts: [],
        missingProductIds: [],
        error: 'product_live_facts_invalid_request',
      };
    }

    const baseUrl = this.readBaseUrl();
    const apiKey = this.readApiKey();
    if (!baseUrl || !apiKey) {
      return {
        ok: false,
        configured: false,
        readOnly: true,
        source: 'not_configured',
        requestedProductIds,
        facts: [],
        missingProductIds: requestedProductIds,
        error: 'product_live_facts_not_configured',
      };
    }

    const facts: ProductLiveFact[] = [];
    const missingProductIds: string[] = [];
    let terminalError: NonTimeoutProductLiveFactsError | null = null;

    for (const product of requestedProducts) {
      const result = await this.fetchProduct(baseUrl, apiKey, product);
      if (!result.ok) {
        if (result.error === 'product_live_facts_timeout') {
          return this.failure(
            requestedProductIds,
            requestedProductIds.filter(
              (productId) => !facts.some((fact) => fact.productId === productId),
            ),
            result.error,
          );
        }
        missingProductIds.push(product.productId);
        terminalError = chooseTerminalError(terminalError, result.error);
        continue;
      }

      facts.push(result.fact);
    }

    return {
      ok: facts.length > 0,
      configured: true,
      readOnly: true,
      source: 'vendre',
      requestedProductIds,
      facts,
      missingProductIds,
      ...(facts.length === 0
        ? {
            error:
              terminalError ||
              ('product_live_facts_upstream_error' as const),
          }
        : {}),
    };
  }

  private async fetchProduct(
    baseUrl: string,
    apiKey: string,
    requestProduct: ProductLiveFactsRequestProduct,
  ): Promise<
    | { ok: true; fact: ProductLiveFact }
    | {
        ok: false;
        error:
          | 'product_live_facts_timeout'
          | 'product_live_facts_upstream_error'
          | 'product_live_facts_invalid_response';
      }
  > {
    if (!/^\d+$/.test(requestProduct.productId)) {
      return { ok: false, error: 'product_live_facts_invalid_response' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.readTimeout());

    try {
      const url = new URL(
        `/API/1/products/${encodeURIComponent(requestProduct.productId)}`,
        `${baseUrl}/`,
      );
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Authorization': apiKey,
        },
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, error: 'product_live_facts_upstream_error' };
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { ok: false, error: 'product_live_facts_invalid_response' };
      }

      const product = unwrapRecord(body);
      if (!product) {
        return { ok: false, error: 'product_live_facts_invalid_response' };
      }

      const fact = this.toFact(product, requestProduct);
      return fact
        ? { ok: true, fact }
        : { ok: false, error: 'product_live_facts_invalid_response' };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'product_live_facts_timeout'
            : 'product_live_facts_upstream_error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private toFact(
    product: UnknownRecord,
    requestProduct: ProductLiveFactsRequestProduct,
  ): ProductLiveFact | null {
    const productId = asText(product.id);
    const title = readSwedishName(product.name);
    const priceExVat = resolveCurrentPriceExVat(product);
    const quantity = asFiniteNumber(product.quantity);

    if (
      productId !== requestProduct.productId ||
      !title ||
      priceExVat === null ||
      quantity === null
    ) {
      return null;
    }

    return {
      productId,
      canonicalUrl: requestProduct.canonicalUrl,
      title,
      imageUrl: requestProduct.imageUrl,
      price: {
        amount: roundCurrency(priceExVat * (1 + SWEDISH_STANDARD_VAT_RATE)),
        currency: 'SEK',
      },
      stock: {
        quantity: Math.max(0, Math.trunc(quantity)),
        availability: quantity > 0 ? 'in_stock' : 'out_of_stock',
      },
      active: toBoolean(product.status, false),
      visible: toBoolean(product.show, false),
      source: 'vendre',
      fetchedAt: new Date().toISOString(),
    };
  }

  private failure(
    requestedProductIds: string[],
    missingProductIds: string[],
    error: 'product_live_facts_timeout' | 'product_live_facts_upstream_error',
  ): ProductLiveFactsLookupResult {
    return {
      ok: false,
      configured: true,
      readOnly: true,
      source: 'vendre',
      requestedProductIds,
      facts: [],
      missingProductIds,
      error,
    };
  }

  private readBaseUrl(): string | null {
    return normalizeVendreHttpsBaseUrl(process.env.VENDRE_API_BASE_URL);
  }

  private readApiKey(): string {
    return String(process.env.VENDRE_API_KEY || '').trim();
  }

  private isConfigured(): boolean {
    return Boolean(this.readBaseUrl() && this.readApiKey());
  }

  private readTimeout(): number {
    const configured = Number(process.env.AI_ARMAN_VENDRE_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
    return Math.min(3000, Math.max(300, configured));
  }
}

function chooseTerminalError(
  current: NonTimeoutProductLiveFactsError | null,
  next: NonTimeoutProductLiveFactsError,
): NonTimeoutProductLiveFactsError {
  if (current === 'product_live_facts_upstream_error') return current;
  if (next === 'product_live_facts_upstream_error') return next;
  return 'product_live_facts_invalid_response';
}

function unwrapRecord(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  return isRecord(value.data) ? value.data : value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSwedishName(value: unknown): string | null {
  if (isRecord(value)) return asText(value.sv);
  return asText(value);
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text || null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'ja', 'on', 'active', 'aktiv'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'nej', 'off', 'inactive', 'inaktiv'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function resolveCurrentPriceExVat(product: UnknownRecord): number | null {
  const regular = asFiniteNumber(product.price);
  const special = asFiniteNumber(product.price_special);

  if (special !== null && special > 0 && isSpecialPriceActive(product.price_special_date_range)) {
    return special;
  }

  return regular !== null && regular > 0 ? regular : null;
}

function isSpecialPriceActive(value: unknown, nowMs = Date.now()): boolean {
  if (!isRecord(value)) return true;

  const from = parseDateBoundary(value.from, false);
  const to = parseDateBoundary(value.to, true);

  if (from === 'invalid' || to === 'invalid') return false;
  if (typeof from === 'number' && nowMs < from) return false;
  if (typeof to === 'number' && nowMs > to) return false;
  return true;
}

function parseDateBoundary(
  value: unknown,
  endOfDay: boolean,
): number | null | 'invalid' {
  if (value === null || value === undefined || value === '' || value === 0 || value === '0') {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 'invalid';
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  if (typeof value !== 'string') return 'invalid';
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = Date.parse(
    dateOnly
      ? `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
      : text,
  );
  return Number.isFinite(parsed) ? parsed : 'invalid';
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
