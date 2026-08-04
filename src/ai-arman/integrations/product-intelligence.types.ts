export const PRODUCT_INTELLIGENCE_CONTRACT_VERSION =
  'ai-arman-product-intelligence-v1' as const;

export type IntelligenceEvidenceSource =
  | 'product_data'
  | 'product_tag'
  | 'product_category'
  | 'ingredient_intelligence'
  | 'rule'
  | 'manual';

export type ProductIntelligenceEvidence = {
  source: IntelligenceEvidenceSource;
  key: string;
  confidence: number;
  direction?: 'positive' | 'negative' | 'neutral';
  reason?: string;
};

export type ProductIntelligenceRequestProduct = {
  productId: string;
  title: string;
  url?: string;
};

export type ProductIntelligenceBatchRequest = {
  contractVersion: typeof PRODUCT_INTELLIGENCE_CONTRACT_VERSION;
  customerNeed: {
    message: string;
  };
  products: ProductIntelligenceRequestProduct[];
};

export type ProductIntelligenceAnalysis = {
  productId: string;
  designation: {
    normalized: string;
    score: number;
    reasons: string[];
  };
  inci: {
    original: string;
    suitabilityScore: number;
    signals: string[];
    conflicts: string[];
    confidence: number;
    engineVersion: string;
    analyzedAt: string;
  };
  category: {
    score: number;
    reasons: string[];
    values: string[];
  };
  tags: {
    score: number;
    reasons: string[];
    values: string[];
  };
  hardBlockers: string[];
  limitations: string[];
  usage: string[];
  specialFit: string[];
  evidence: ProductIntelligenceEvidence[];
};

export type ProductIntelligenceBatchResponse = {
  ok: boolean;
  contractVersion: typeof PRODUCT_INTELLIGENCE_CONTRACT_VERSION;
  engineVersion: string;
  generatedAt: string;
  analyses: ProductIntelligenceAnalysis[];
};

export type ProductIntelligenceLookupResult = {
  ok: boolean;
  configured: boolean;
  durationMs: number;
  analyses: ProductIntelligenceAnalysis[];
  engineVersion?: string;
  generatedAt?: string;
  upstreamStatus?: number;
  error?:
    | 'product_intelligence_not_configured'
    | 'product_intelligence_timeout'
    | 'product_intelligence_request_failed'
    | 'product_intelligence_upstream_error'
    | 'product_intelligence_contract_invalid';
};
