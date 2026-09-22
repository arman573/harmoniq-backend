export type MailAgentCategory =
  | 'customer_service'
  | 'returns_claims'
  | 'supplier'
  | 'invoice_finance'
  | 'order_purchase'
  | 'marketing_ads'
  | 'compliance_legal'
  | 'system_alert'
  | 'calendar_training'
  | 'newsletter_promo'
  | 'personal'
  | 'unknown';

export type MailAgentPriority = 'critical' | 'high' | 'normal' | 'low';

export type MailAgentNextAction =
  | 'route_returns'
  | 'route_finance'
  | 'route_supplier_ops'
  | 'route_marketing'
  | 'draft_reply'
  | 'review'
  | 'archive_candidate'
  | 'ignore_candidate';

export type MailAgentSpecialist =
  | 'returns-module'
  | 'finance'
  | 'supplier-ops'
  | 'marketing'
  | 'general'
  | 'none';

export interface MailEnvelope {
  mailbox?: string;
  providerMessageId?: string;
  rfcMessageId?: string;
  dedupeKey?: string;
  direction?: 'inbound' | 'outbound';
  id?: string;
  threadId?: string;
  from: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  body?: string;
  receivedAt?: string;
  hasAttachment?: boolean;
  labels?: string[];
}

export interface MailTriageResult {
  category: MailAgentCategory;
  priority: MailAgentPriority;
  confidence: number;
  nextAction: MailAgentNextAction;
  specialist: MailAgentSpecialist;
  requiresHumanApproval: boolean;
  automationAllowed: boolean;
  reasons: string[];
  riskFlags: string[];
}

export interface MailAgentDecision {
  message: MailEnvelope;
  triage: MailTriageResult;
}
