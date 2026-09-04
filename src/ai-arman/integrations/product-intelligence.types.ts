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

export type ProductIntelligenceOpenAiSource = {
  url: string;
  title: string;
};

export type ProductIntelligenceOpenAiProductResearch = {
  productId: string;
  verdict: 'supported' | 'mixed' | 'unsupported' | 'uncertain';
  summary: string;
  ingredientFindings: string[];
  problemSolving: string[];
  cautions: string[];
  confidence: number;
  recommendationAction: 'retain' | 'caution' | 'block' | 'insufficient';
  sources: ProductIntelligenceOpenAiSource[];
  model: string;
  webSearchUsed: boolean;
  cached: boolean;
};

export type ProductIntelligenceOpenAiUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ProductIntelligenceOpenAiCost = {
  allowed: boolean;
  reason: string;
  estimatedMaximumUsd: number;
  requestLimitUsd: number;
  dailyLimitUsd: number;
  spentTodayUsd: number;
  remainingTodayUsd: number;
  actualUsd: number;
  inputUsd: number;
  cachedInputUsd: number;
  outputUsd: number;
  currency: 'USD';
  pricingVersion: 'gpt-5.6-luna-2026-08';
};

export type ProductIntelligenceOpenAiVerification = {
  enabled: boolean;
  attempted: boolean;
  required: boolean;
  reason: string;
  model: string;
  webSearchUsed: boolean;
  cacheHit: boolean;
  products: ProductIntelligenceOpenAiProductResearch[];
  usage?: ProductIntelligenceOpenAiUsage;
  cost: ProductIntelligenceOpenAiCost;
  error?: string;
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
  verification: ProductIntelligenceOpenAiVerification;
};

export type ProductIntelligenceLookupResult = {
  ok: boolean;
  configured: boolean;
  durationMs: number;
  analyses: ProductIntelligenceAnalysis[];
  engineVersion?: string;
  generatedAt?: string;
  verification?: ProductIntelligenceOpenAiVerification;
  upstreamStatus?: number;
  error?:
    | 'product_intelligence_not_configured'
    | 'product_intelligence_auth_not_configured'
    | 'product_intelligence_auth_failed'
    | 'product_intelligence_request_invalid'
    | 'product_intelligence_timeout'
    | 'product_intelligence_request_failed'
    | 'product_intelligence_upstream_error'
    | 'product_intelligence_contract_invalid';
};
