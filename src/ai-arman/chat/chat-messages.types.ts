import type { SkincareSpecialistProfile } from '../skincare/skincare-specialist-profile';

export const AI_ARMAN_CHAT_CONTRACT_VERSION = 'ai-arman-chat-v1' as const;
export const AI_ARMAN_CONVERSATION_STATE_VERSION =
  'ai-arman-conversation-state-v1' as const;

export type AiArmanChatChannel = 'web_widget' | 'internal_preview';

export type AiArmanChatRequest = {
  contractVersion: typeof AI_ARMAN_CHAT_CONTRACT_VERSION;
  conversationId?: string;
  clientMessageId: string;
  message: {
    text: string;
  };
  context?: {
    locale?: 'sv-SE';
    channel?: AiArmanChatChannel;
    page?: {
      url?: string;
      productId?: string;
    };
  };
};

export type AiArmanIntent =
  | 'product_recommendation'
  | 'purchased_product_usage'
  | 'order_status'
  | 'tracking_status'
  | 'return_help'
  | 'claim_help'
  | 'human_handoff'
  | 'greeting'
  | 'unknown';

export type AiArmanJourney =
  | 'before_purchase'
  | 'after_purchase'
  | 'customer_service'
  | 'general';

export type AiArmanBeautyDomain =
  | 'haircare'
  | 'skincare'
  | 'fragrance'
  | 'makeup'
  | 'nails';

export type AiArmanSkincareActive =
  | 'retinoid'
  | 'aha'
  | 'bha'
  | 'pha'
  | 'vitamin_c'
  | 'niacinamide'
  | 'azelaic_acid'
  | 'benzoyl_peroxide';

export type AiArmanRoutineTiming = 'morning' | 'evening' | 'unspecified';

export type AiArmanSkincareRoutineActive = {
  active: AiArmanSkincareActive;
  timing: AiArmanRoutineTiming;
};

export type AiArmanSkincareRoutineReviewFlag =
  | 'retinoid_with_exfoliating_acid'
  | 'potentially_irritating_active_timing_unspecified'
  | 'multiple_potentially_irritating_actives'
  | 'sensitive_skin_with_potentially_irritating_active';

export type AiArmanSkincareRoutineReview = {
  version: 'skincare-routine-safety-review-v1';
  status: 'clear' | 'review_required';
  flags: AiArmanSkincareRoutineReviewFlag[];
  requiresReview: boolean;
  blocksRecommendation: false;
};

export type AiArmanProductType =
  | 'shampoo'
  | 'conditioner'
  | 'hair_mask'
  | 'leave_in'
  | 'cleanser'
  | 'face_cream'
  | 'serum'
  | 'spf'
  | 'fragrance'
  | 'foundation'
  | 'concealer'
  | 'lipstick'
  | 'mascara'
  | 'nail_polish'
  | 'base_coat'
  | 'top_coat'
  | 'nail_treatment';

export type AiArmanInterpretationEntities = {
  requestedProductTypes: AiArmanProductType[];
  needs: string[];
  exclusions: string[];
  orderReference: string | null;
  productReferences: string[];
  recommendationDomain?: AiArmanBeautyDomain | null;
  skincareRoutineActives?: AiArmanSkincareRoutineActive[];
  skincareSpecialistProfile?: SkincareSpecialistProfile;
};

export type AiArmanInterpretationBase = {
  schemaVersion: 'ai-arman-interpretation-v1';
  locale: 'sv-SE';
  primaryIntent: AiArmanIntent;
  secondaryIntents: AiArmanIntent[];
  confidence: number;
  entities: AiArmanInterpretationEntities;
  missingFields: string[];
  requiresIdentity: boolean;
  requiresHumanReview: boolean;
};

export type AiArmanInterpretation = AiArmanInterpretationBase & {
  source: 'deterministic_fallback';
};

export type AiArmanModelInterpretationCandidate = AiArmanInterpretationBase & {
  source: 'model_candidate';
};

export type AiArmanConversationState = {
  stateVersion: typeof AI_ARMAN_CONVERSATION_STATE_VERSION;
  conversationId: string;
  status: 'collecting' | 'ready_for_tools' | 'handoff_required';
  activeJourney: AiArmanJourney;
  locale: 'sv-SE';
  identityLevel: 'anonymous';
  remembered: {
    requestedProductTypes: AiArmanProductType[];
    needs: string[];
    exclusions: string[];
    orderReference: string | null;
    productReferences: string[];
    recommendationDomain?: AiArmanBeautyDomain | null;
    skincareRoutineActives?: AiArmanSkincareRoutineActive[];
    skincareSpecialistProfile?: SkincareSpecialistProfile;
  };
  pendingQuestion: {
    id: string;
    expectedField: string;
  } | null;
};

export type AiArmanToolName =
  | 'search_products'
  | 'analyze_product_suitability'
  | 'get_product_live_facts'
  | 'get_order'
  | 'get_tracking_status'
  | 'get_case_status'
  | 'get_case_messages'
  | 'prepare_return_case'
  | 'prepare_claim_case'
  | 'handoff_to_customer_service';

export type AiArmanDecision = {
  owner: 'backend_policy';
  route:
    | 'recommendation'
    | 'purchased_product_guidance'
    | 'order_support'
    | 'returns_support'
    | 'human_support'
    | 'general';
  plannedTools: AiArmanToolName[];
  executionStatus:
    | 'not_executed_foundation'
    | 'executed_read_only'
    | 'failed_closed';
  requiresIdentity: boolean;
  requiresConfirmation: false;
  reasons: string[];
};

export type AiArmanMessageBlock = {
  type: 'message';
  text: string;
};

export type AiArmanQuestionBlock = {
  type: 'question';
  id: string;
  text: string;
  expectedField: string;
  required: boolean;
};

export type AiArmanQuickRepliesBlock = {
  type: 'quick_replies';
  options: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

export type AiArmanProductCardBlock = {
  type: 'product_cards';
  cards: Array<{
    productId: string;
    title: string;
    imageUrl: string | null;
    productUrl: string;
    price: number | null;
    currency: 'SEK' | null;
    stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
    whyItFits: string[];
    inciSignals: string[];
    limitations: string[];
    usage: string[];
    confidence: number;
    factsFetchedAt: string;
  }>;
};

export type AiArmanOrderStatusCardBlock = {
  type: 'order_status_card';
  orderNumber: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
};

export type AiArmanTrackingCardBlock = {
  type: 'tracking_card';
  orderNumber: string;
  carrier: string | null;
  trackingStatus: string;
  trackingLabel: string;
  trackingUrl: string | null;
  updatedAt: string;
};

export type AiArmanPurchasedProductCardBlock = {
  type: 'purchased_product_card';
  orderNumber: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
};

export type AiArmanSafetyNoticeBlock = {
  type: 'safety_notice';
  severity: 'info' | 'warning' | 'urgent';
  text: string;
};

export type AiArmanSupportHandoffBlock = {
  type: 'support_handoff';
  status: 'available' | 'not_configured';
  reason: string;
  transcriptPreserved: boolean;
};

export type AiArmanErrorNoticeBlock = {
  type: 'error_notice';
  code: string;
  text: string;
  retryable: boolean;
};

export type AiArmanResponseBlock =
  | AiArmanMessageBlock
  | AiArmanQuestionBlock
  | AiArmanQuickRepliesBlock
  | AiArmanProductCardBlock
  | AiArmanOrderStatusCardBlock
  | AiArmanTrackingCardBlock
  | AiArmanPurchasedProductCardBlock
  | AiArmanSafetyNoticeBlock
  | AiArmanSupportHandoffBlock
  | AiArmanErrorNoticeBlock;

export type AiArmanChatResponse = {
  contractVersion: typeof AI_ARMAN_CHAT_CONTRACT_VERSION;
  conversationId: string;
  serverMessageId: string;
  interpretation: AiArmanInterpretation;
  state: AiArmanConversationState;
  decision: AiArmanDecision;
  blocks: AiArmanResponseBlock[];
  safety: {
    aiModelUsed: false;
    liveFactsUsed: boolean;
    writesExecuted: false;
    productionActionsEnabled: false;
    htmlAcceptedFromModel: false;
    skincareRoutineReview?: AiArmanSkincareRoutineReview | null;
  };
};
