import type {
  SupportIntegrationCapability,
  SupportIntegrationStatus,
} from './support-integration.types';

export const CUSTOMER_CHAT_CHANNELS = ['web', 'chat', 'email', 'sms'] as const;

export type CustomerChatChannel = (typeof CUSTOMER_CHAT_CHANNELS)[number];

export type CustomerChatIntentType =
  | 'product_recommendation'
  | 'mixed_support_recommendation'
  | 'profile_update'
  | 'support_request'
  | 'escalation_request'
  | 'safety_concern'
  | 'frustration'
  | 'abusive_language'
  | 'off_topic'
  | 'unsafe_or_inappropriate'
  | 'greeting'
  | 'unknown';

export type CustomerChatIntentSource =
  | 'deterministic_rules'
  | 'ai_interpreter_placeholder';

export type CustomerChatIntent = {
  type: CustomerChatIntentType;
  confidence: number;
  source: CustomerChatIntentSource;
  normalizedMessage: string;
  signals: string[];
};

export type CustomerChatRoute =
  | 'recommendation'
  | 'profile'
  | 'support'
  | 'escalation'
  | 'boundary'
  | 'off_topic'
  | 'guidance';

export type CustomerChatBoundaryType =
  | 'none'
  | 'unsafe'
  | 'inappropriate'
  | 'medical';

export type CustomerChatEscalationPriority = 'none' | 'low' | 'medium' | 'high';

export type CustomerChatNextAction = {
  type:
    | 'fetch_recommendations'
    | 'view_profile'
    | 'support_handoff'
    | 'ask_clarifying_question'
    | 'none';
  label: string;
  status: 'available' | 'placeholder' | 'blocked' | 'not_required';
  endpoint?: string;
};

export type CustomerChatPolicyDecision = {
  route: CustomerChatRoute;
  allowed: boolean;
  captureCustomerFacts: boolean;
  reasons: string[];
  boundary: {
    type: CustomerChatBoundaryType;
    reason?: string;
  };
  escalation: {
    required: boolean;
    priority: CustomerChatEscalationPriority;
    reason?: string;
  };
  nextActions: CustomerChatNextAction[];
};

export type CustomerChatComposedResponse = {
  text: string;
  followUpPrompts: string[];
};

export type BeautyProfileSummary = {
  domainsDetected: string[];
  topConcerns: string[];
  topPreferences: string[];
  topSensitivities: string[];
  confidence: number;
  confidenceLevel: 'low' | 'medium' | 'high';
};

export type CustomerChatIntegrationStatus = {
  status: 'available' | 'placeholder' | 'blocked' | 'not_required';
  capability?: SupportIntegrationCapability;
  integrationStatus?: SupportIntegrationStatus;
  handled?: boolean;
  requiresHuman?: boolean;
  missingFields?: string[];
  safeCustomerMessage?: string;
  externalReference?: string;
  endpoint?: string;
  note?: string;
};

export type CustomerChatResult = {
  customerId: number;
  conversationId: string;
  message: string;
  intent: CustomerChatIntent;
  route: CustomerChatRoute;
  policy: CustomerChatPolicyDecision;
  escalationRequired: boolean;
  confidence: number;
  reasons: string[];
  suggestedActions: CustomerChatNextAction[];
  response: CustomerChatComposedResponse;
  beautyProfileSummary: BeautyProfileSummary;
  capturedFactsCount: number;
  integrations: {
    recommendations: CustomerChatIntegrationStatus;
    support: CustomerChatIntegrationStatus;
  };
  metadata: {
    aiUsed: false;
    decisionOwner: 'backend_policy';
    handledBy: 'harmoniq_customer_core_v1';
    generatedAt: string;
  };
  audit: {
    userMessageId?: number;
    assistantMessageId?: number;
    boundaryType: CustomerChatBoundaryType;
    createdAt: string;
  };
};

export type CustomerChatHistoryMessage = {
  id: number;
  role: 'user' | 'assistant' | 'human';
  content: string;
  intentType?: string;
  intentConfidence?: number;
  policyRoute?: string;
  escalationRequired: boolean;
  reasons: string[];
  boundaryType: CustomerChatBoundaryType;
  integrations?: {
    recommendations: CustomerChatIntegrationStatus;
    support: CustomerChatIntegrationStatus;
  };
  createdAt: Date;
};

export type CustomerChatHistoryConversation = {
  id: number;
  customerId: number;
  conversationId: string;
  channel: CustomerChatChannel;
  status: string;
  lastIntentType?: string;
  lastIntentConfidence?: number;
  lastPolicyRoute?: string;
  boundaryType: CustomerChatBoundaryType;
  escalationRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages: CustomerChatHistoryMessage[];
};

export type CustomerChatHistoryResult = {
  customerId: number;
  conversations: CustomerChatHistoryConversation[];
};

export type CustomerChatResponseContext = {
  intent: CustomerChatIntent;
  policy: CustomerChatPolicyDecision;
  beautyProfileSummary: BeautyProfileSummary;
  domainsDetected: string[];
};
