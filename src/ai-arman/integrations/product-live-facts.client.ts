import { Injectable } from '@nestjs/common';
import {
  PRODUCT_LIVE_FACTS_MAX_PRODUCTS,
  ProductLiveFactsLookupResult,
  ProductLiveFactsRequestProduct,
} from './product-live-facts.types';

export type ProductLiveFactsInput = ProductLiveFactsRequestProduct[];

export abstract class ProductLiveFactsClient {
  abstract getFacts(
    products: ProductLiveFactsInput,
  ): Promise<ProductLiveFactsLookupResult>;
}

@Injectable()
export class DisabledProductLiveFactsClient extends ProductLiveFactsClient {
  async getFacts(
    products: ProductLiveFactsInput,
  ): Promise<ProductLiveFactsLookupResult> {
    const requestedProductIds = normalizeProductIds(products);

    if (requestedProductIds.length === 0) {
      return {
        ok: false,
        configured: false,
        readOnly: true,
        source: 'not_configured',
        requestedProductIds: [],
        facts: [],
        missingProductIds: [],
        error: 'product_live_facts_invalid_request',
      };
    }

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
}

export function normalizeProductLiveFactsRequest(
  products: unknown,
): ProductLiveFactsRequestProduct[] {
  if (!Array.isArray(products)) return [];

  const seen = new Set<string>();
  const normalized: ProductLiveFactsRequestProduct[] = [];

  for (const raw of products) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;

    const product = raw as Partial<ProductLiveFactsRequestProduct>;
    const productId = String(product.productId || '').trim();
    const title = String(product.title || '').trim();
    const canonicalUrl = String(product.canonicalUrl || '').trim();
    const imageUrl = String(product.imageUrl || '').trim() || null;

    if (!productId || !title || !canonicalUrl || seen.has(productId)) continue;

    seen.add(productId);
    normalized.push({ productId, title, canonicalUrl, imageUrl });

    if (normalized.length >= PRODUCT_LIVE_FACTS_MAX_PRODUCTS) break;
  }

  return normalized;
}

function normalizeProductIds(products: unknown): string[] {
  return normalizeProductLiveFactsRequest(products).map(
    (product) => product.productId,
  );
}
