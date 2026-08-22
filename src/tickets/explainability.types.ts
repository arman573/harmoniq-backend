export type ExplainabilityStatus =
  | 'not_required'
  | 'available'
  | 'limited'
  | 'insufficient_context';

export type ExplainabilitySource =
  | 'backend_policy'
  | 'deterministic_intent'
  | 'customer_profile_summary'
  | 'conversation_context'
  | 'support_placeholder'
  | 'recommendation_evidence_contract'
  | 'manual_admin_context';

export type ExplainabilityVisibility =
  | 'customer_safe'
  | 'admin_only';

export interface ExplainabilityReason {
  code: string;
  label: string;
  source: ExplainabilitySource;
  visibility: ExplainabilityVisibility;
}

export interface ExplainabilitySummary {
  status: ExplainabilityStatus;
  decisionOwner: 'backend_policy';
  aiUsed: false;
  reasons: ExplainabilityReason[];
  limitations: string[];
}

export const EMPTY_EXPLAINABILITY_SUMMARY: ExplainabilitySummary = {
  status: 'not_required',
  decisionOwner: 'backend_policy',
  aiUsed: false,
  reasons: [],
  limitations: [],
};
