import { Injectable } from '@nestjs/common';
import {
  PRODUCT_LIVE_FACTS_MAX_PRODUCTS,
  ProductLiveFactsLookupResult,
  ProductLiveFactsRequestProduct,
} from './product-live-facts.types';

export abstract class ProductLiveFactsClient {
  abstract getFacts(
    products: ProductLiveFactsRequestProduct[],
  ): Promise<ProductLiveFactsLookupResult>;
}

@Injectable()
export class DisabledProductLiveFactsClient extends ProductLiveFactsClient {
  async getFacts(
    products: ProductLiveFactsRequestProduct[],
  ): Promise<ProductLiveFactsLookupResult> {
    const requestedProducts = normalizeProducts(products);
    const requestedProductIds = requestedProducts.map((product) => product.productId);

    if (requestedProducts.length === 0) {
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
  products: ProductLiveFactsRequestProduct[],
): ProductLiveFactsRequestProduct[] {
  return normalizeProducts(products);
}

function normalizeProducts(
  products: ProductLiveFactsRequestProduct[],
): ProductLiveFactsRequestProduct[] {
  if (!Array.isArray(products)) return [];

  const seen = new Set<string>();
  const normalized: ProductLiveFactsRequestProduct[] = [];

  for (const product of products) {
    const productId = String(product?.productId || '').trim();
    const title = String(product?.title || '').trim();
    const canonicalUrl = String(product?.canonicalUrl || '').trim();
    const imageUrl = String(product?.imageUrl || '').trim() || null;

    if (!productId || !title || !canonicalUrl || seen.has(productId)) continue;

    seen.add(productId);
    normalized.push({ productId, title, canonicalUrl, imageUrl });

    if (normalized.length >= PRODUCT_LIVE_FACTS_MAX_PRODUCTS) break;
  }

  return normalized;
}
