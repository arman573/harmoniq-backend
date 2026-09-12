import type { RecommendationTier } from './recommendation.types';

export const PRODUCT_RECOMMENDATION_CARD_SCHEMA_VERSION =
  'ai-arman-product-card-v1' as const;

export type ProductRecommendationCard = {
  schemaVersion: typeof PRODUCT_RECOMMENDATION_CARD_SCHEMA_VERSION;
  type: 'product_card';
  position: number;
  label: 'Bäst matchning' | 'Godkänt alternativ';
  productId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  price: {
    amount: number;
    currency: string;
  };
  availability: {
    status: 'in_stock';
    quantity: number | null;
  };
  whyItFits: string[];
  inciSignals: string[];
  limitations: string[];
  quality: {
    score: number;
    rankingScore: number;
    tier: Exclude<RecommendationTier, 'REJECTED'>;
    confidence: number;
  };
  verification: {
    productFactsSource: 'vendre';
    fetchedAt: string;
  };
};
