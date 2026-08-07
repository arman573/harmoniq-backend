import { Injectable } from '@nestjs/common';
import {
  PRODUCT_LIVE_FACTS_MAX_PRODUCTS,
  ProductLiveFactsLookupResult,
} from './product-live-facts.types';

@Injectable()
export class ProductLiveFactsClient {
  async getFacts(productIds: string[]): Promise<ProductLiveFactsLookupResult> {
    const requestedProductIds = normalizeProductIds(productIds);

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

function normalizeProductIds(productIds: string[]): string[] {
  if (!Array.isArray(productIds)) return [];

  return [...new Set(productIds.map(String).map((value) => value.trim()).filter(Boolean))]
    .slice(0, PRODUCT_LIVE_FACTS_MAX_PRODUCTS);
}
