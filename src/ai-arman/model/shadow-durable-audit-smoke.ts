import { StructuredLoggingChatInterpretationShadowAuditSink } from '../chat/chat-interpretation-shadow-durable-audit.sink';
import type { ChatInterpretationShadowAuditRecord } from '../chat/chat-interpretation-shadow-audit.store';

const record: ChatInterpretationShadowAuditRecord & Record<string, unknown> = {
  recordedAt: new Date().toISOString(),
  provider: 'synthetic-transport-smoke',
  modelVersion: 'synthetic-v1',
  promptVersion: 'synthetic-v1',
  status: 'completed',
  latencyMs: 1,
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  estimatedCostUsd: 0,
  candidateValid: true,
  primaryIntentMatch: true,
  customerEmail: 'privacy-test@example.invalid',
  orderId: 'ORDER-DO-NOT-LOG',
  rawMessage: 'PRIVATE-MESSAGE-DO-NOT-LOG',
  modelText: 'MODEL-TEXT-DO-NOT-LOG',
};

new StructuredLoggingChatInterpretationShadowAuditSink().record(record);
