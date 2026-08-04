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
