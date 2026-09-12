export type SearchBrainProduct = {
  title?: string;
  brand?: string;
  url?: string;
  imageUrl?: string;
  price?: unknown;
  source?: string;
  score?: number;
};

export type SearchBrainAutocompleteResponse = {
  ok: boolean;
  query: string;
  normalizedQuery?: string;
  navigationTarget?: {
    type?: string;
    label?: string;
    url?: string;
    source?: string;
    score?: number;
  };
  products?: SearchBrainProduct[];
  debug?: {
    recommendedAction?: string;
    sourceStatus?: unknown;
    notes?: string[];
  };
};

export type SearchBrainLookupResult = {
  ok: boolean;
  configured: boolean;
  query: string;
  durationMs: number;
  upstreamStatus?: number;
  products: SearchBrainProduct[];
  navigationTarget?: SearchBrainAutocompleteResponse['navigationTarget'];
  error?: string;
};
