export type RecommendationEvidenceSource =
  | 'customer_fact'
  | 'customer_profile'
  | 'product_tag'
  | 'product_analysis'
  | 'rule'
  | 'manual';

export type RecommendationEvidencePolarity =
  | 'positive'
  | 'negative'
  | 'neutral';

export type RecommendationEvidenceConfidenceLevel =
  | 'low'
  | 'medium'
  | 'high';

export type RecommendationEvidenceItem = {
  code: string;
  label: string;
  detail: string;
  source: RecommendationEvidenceSource;
  domain: string;
  confidence: number;
  polarity: RecommendationEvidencePolarity;
  impact?: number;
};

export type RecommendationEvidenceConflict = {
  code: string;
  label: string;
  detail: string;
  domain: string;
  severity: RecommendationEvidenceConfidenceLevel;
};

export type RecommendationEvidenceSummary = {
  confidence: number;
  confidenceLevel: RecommendationEvidenceConfidenceLevel;
  positiveEvidence: RecommendationEvidenceItem[];
  negativeEvidence: RecommendationEvidenceItem[];
  neutralEvidence: RecommendationEvidenceItem[];
  missingEvidence: string[];
  conflicts: RecommendationEvidenceConflict[];
};

export type RecommendationEvidenceContract = {
  status: 'available' | 'not_available';
  summary?: RecommendationEvidenceSummary;
  note?: string;
};
