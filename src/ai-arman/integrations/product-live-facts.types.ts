export const PRODUCT_LIVE_FACTS_MAX_PRODUCTS = 25;

export type ProductLiveFactsAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'unknown';

export type ProductLiveFactsErrorCode =
  | 'product_live_facts_invalid_request'
  | 'product_live_facts_not_configured'
  | 'product_live_facts_timeout'
  | 'product_live_facts_upstream_error'
  | 'product_live_facts_invalid_response';

export type ProductLiveFactsRequestProduct = {
  productId: string;
  title: string;
  canonicalUrl: string;
  imageUrl: string | null;
};

export type ProductLiveFact = {
  productId: string;
  canonicalUrl: string;
  title: string;
  imageUrl: string | null;
  price: {
    amount: number;
    currency: string;
  };
  stock: {
    quantity: number | null;
    availability: ProductLiveFactsAvailability;
  };
  active: boolean;
  visible: boolean;
  source: 'vendre';
  fetchedAt: string;
};

export type ProductLiveFactsLookupResult = {
  ok: boolean;
  configured: boolean;
  readOnly: true;
  source: 'vendre' | 'not_configured';
  requestedProductIds: string[];
  facts: ProductLiveFact[];
  missingProductIds: string[];
  error?: ProductLiveFactsErrorCode;
};
