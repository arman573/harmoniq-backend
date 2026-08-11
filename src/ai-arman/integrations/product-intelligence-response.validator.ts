import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  ProductIntelligenceAnalysis,
  ProductIntelligenceBatchResponse,
  ProductIntelligenceEvidence,
  ProductIntelligenceOpenAiCost,
  ProductIntelligenceOpenAiProductResearch,
  ProductIntelligenceOpenAiUsage,
  ProductIntelligenceOpenAiVerification,
} from './product-intelligence.types';

type UnknownRecord = Record<string, unknown>;

const MAX_RESPONSE