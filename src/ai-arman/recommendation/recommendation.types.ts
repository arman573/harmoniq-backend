export type RecommendationTier = 'A' | 'B' | 'C' | 'REJECTED';

export type RecommendationScores = {
  designation: number;
  inciSuitability: number;
  category: number;
  tags: number;
};

export type RecommendationEvidence = {
  designationReasons: string[];
  inciSignals: string[];
  categoryReasons: string[];
  tagReasons: string[];
  limitations: string[];
  confidence: number;
  engineVersion: string;
};

export type RecommendationCandidate = {
  productId: string;
  title: string;
  scores: RecommendationScores;
  hardBlockers?: string[];
  personalizationScore?: number;
  evidence: RecommendationEvidence;
};

export type ScoredRecommendationCandidate = RecommendationCandidate & {
  qualityScore: number;
  tier: RecommendationTier;
  eligible: boolean;
  rejectionReasons: string[];
  boundedPersonalizationScore: number;
};

export type RecommendationWeights = {
  designation: number;
  inciSuitability: number;
  category: number;
  tags: number;
};

export type RecommendationGates = {
  minimumDesignation: number;
  minimumInciSuitability: number;
  minimumQuality: number;
};
