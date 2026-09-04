export const RETURNS_MODULE_CONTRACT_VERSION =
  'ai-arman-returns-module-v1' as const;

export type ReturnsModuleVerificationMethod =
  | 'order_email_otp'
  | 'account_assertion';

export type ReturnsModuleVerifiedCustomerContext = {
  verificationId: string;
  verificationMethod: ReturnsModuleVerificationMethod;
  subjectHash: string;
  verifiedOrderIds: string[];
  verifiedAt: string;
  expiresAt: string;
};

export type ReturnsModuleCaseType =
  | 'return'
  | 'claim'
  | 'wrong_item'
  | 'missing_item'
  | 'support';

export type ReturnsModuleCaseMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  sender: 'Kund' | 'HARMONIQ';
  subject: string;
  text: string;
  date: string;
};

export type ReturnsModuleCustomerCase = {
  caseId: string;
  orderId: string;
  caseType: ReturnsModuleCaseType;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  messages: ReturnsModuleCaseMessage[];
};

export type ReturnsModuleCaseContextRequest = {
  contractVersion: typeof RETURNS_MODULE_CONTRACT_VERSION;
  verification: ReturnsModuleVerifiedCustomerContext;
  orderId: string;
  caseId?: string;
};

export type ReturnsModuleCaseContextResponse = {
  ok: true;
  contractVersion: typeof RETURNS_MODULE_CONTRACT_VERSION;
  orderId: string;
  cases: ReturnsModuleCustomerCase[];
};

export type ReturnsModuleWriteAuthorization = {
  verification: ReturnsModuleVerifiedCustomerContext;
  confirmationToken: string;
  idempotencyKey: string;
};

export type ReturnsModuleCreateCaseType = Exclude<
  ReturnsModuleCaseType,
  'support'
>;

export type ReturnsModuleCaseProductInput = {
  productId: string;
  orderRowId?: string;
  sku?: string;
  articleNumber?: string;
  name: string;
  quantity: number;
};

export type ReturnsModuleCreateCaseRequest = {
  contractVersion: typeof RETURNS_MODULE_CONTRACT_VERSION;
  authorization: ReturnsModuleWriteAuthorization;
  orderId: string;
  caseType: ReturnsModuleCreateCaseType;
  products: ReturnsModuleCaseProductInput[];
  answers: Record<string, unknown>;
};

export type ReturnsModuleSendCaseMessageRequest = {
  contractVersion: typeof RETURNS_MODULE_CONTRACT_VERSION;
  authorization: ReturnsModuleWriteAuthorization;
  orderId: string;
  caseId: string;
  message: string;
};
