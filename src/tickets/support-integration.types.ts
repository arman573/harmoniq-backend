export type SupportIntegrationStatus =
  | 'not_configured'
  | 'available'
  | 'unavailable'
  | 'error';

export type SupportIntegrationCapability =
  | 'order_lookup'
  | 'return_request'
  | 'claim_wrong_product'
  | 'claim_damaged_product'
  | 'shipping_tracking'
  | 'human_support_handoff';

export type SupportIntegrationContext = {
  customerId: number;
  conversationId?: number;
  messageId?: number;
  intentType?: string;
  route?: string;
};

export type OrderLookupRequest = {
  customerId: number;
  orderNumber?: string;
  email?: string;
};

export type SupportPlaceholderResult<
  TCapability extends SupportIntegrationCapability,
> = {
  status: SupportIntegrationStatus;
  capability: TCapability;
  handled: boolean;
  requiresHuman: boolean;
  summary?: string;
  externalReference?: string;
  missingFields?: string[];
  safeCustomerMessage?: string;
};

export type OrderLookupResult = SupportPlaceholderResult<'order_lookup'>;

export type ReturnRequestResult = SupportPlaceholderResult<'return_request'>;

export type ClaimRequestResult = SupportPlaceholderResult<
  'claim_wrong_product' | 'claim_damaged_product'
>;

export type ShippingTrackingResult =
  SupportPlaceholderResult<'shipping_tracking'>;

export type HumanSupportHandoffResult =
  SupportPlaceholderResult<'human_support_handoff'>;

export type SupportIntegrationResult =
  | OrderLookupResult
  | ReturnRequestResult
  | ClaimRequestResult
  | ShippingTrackingResult
  | HumanSupportHandoffResult;
