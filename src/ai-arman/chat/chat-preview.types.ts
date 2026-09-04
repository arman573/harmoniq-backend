import {
  RecommendationCandidate,
  RecommendationTier,
} from '../recommendation/recommendation.types';

export type PreviewCommercialFacts = {
  price?: number;
  currency?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  productUrl?: string;
  source?: 'preview' | 'vendre';
  fetchedAt?: string;
};

export type ChatPreviewCandidate = RecommendationCandidate & {
  commercialFacts?: PreviewCommercialFacts;
  usage?: string[];
  specialFit?: string[];
};

export type ChatPreviewRequest = {
  message: string;
  candidates: ChatPreviewCandidate[];
};

export type ChatRecommendationCard = {
  position: number;
  label: string;
  productId: string;
  title: string;
  whyItFits: string[];
  needsSolved: string[];
  inciSignals: string[];
  limitations: string[];
  usage: string[];
  qualityScore: number;
  rankingScore: number;
  tier: RecommendationTier;
  confidence: number;
  commercialFacts: PreviewCommercialFacts | null;
};

export type ChatPreviewResponse = {
  ok: true;
  mode: 'chat-preview';
  assistant: {
    name: 'AI Arman';
    disclosure: string;
    message: string;
  };
  summary: {
    received: number;
    eligible: number;
    rejected: number;
  };
  recommendations: ChatRecommendationCard[];
  rejected: Array<{
    productId: string;
    title: string;
    reasons: string[];
  }>;
  safety: {
    liveFactsUsed: false;
    productionActionsEnabled: false;
    composer: 'deterministic-preview-v1';
  };
};
