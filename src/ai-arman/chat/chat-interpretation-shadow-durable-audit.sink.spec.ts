import {
  AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV,
  CompositeChatInterpretationShadowAuditSink,
  StructuredLoggingChatInterpretationShadowAuditSink,
} from './chat-interpretation-shadow-durable-audit.sink';
import { InMemoryChatInterpretationShadowAuditStore } from './chat-interpretation-shadow-audit.store';

const baseRecord = {
  recordedAt: '2026-08-18T16:30:41.000Z',
  provider: 'openai',
  modelVersion: 'gpt-test',
  promptVersion: 'prompt-v1',
  status: 'completed' as const,
  latencyMs: 42,
  inputTokens: 10,
  outputTokens: 4,
  totalTokens: 14,
  estimatedCostUsd: 0.001,
  candidateValid: true,
  primaryIntentMatch: true,
};

describe('StructuredLoggingChatInterpretationShadowAuditSink', () => {
  const originalEnv = process.env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV];

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV];
    } else {
      process.env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV] = originalEnv;
    }
  });

  it('is default-off and writes nothing', () => {
    delete process.env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV];
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    new StructuredLoggingChatInterpretationShadowAuditSink().record(baseRecord);

    expect(write).not.toHaveBeenCalled();
  });

  it('writes only the allowlisted privacy-safe audit schema when enabled', () => {
    process.env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV] = 'true';
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const contaminated = {
      ...baseRecord,
      customerEmail: 'customer@example.com',
      orderId: '90250',
      rawMessage: 'my private message',
      modelText: 'free model output',
    } as typeof baseRecord;

    new StructuredLoggingChatInterpretationShadowAuditSink().record(contaminated);

    expect(write).toHaveBeenCalledTimes(1);
    const raw = String(write.mock.calls[0][0]).trim();
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload).toEqual({
      severity: 'INFO',
      event: 'ai_arman_model_shadow_audit',
      schemaVersion: 1,
      ...baseRecord,
    });
    expect(raw).not.toContain('customer@example.com');
    expect(raw).not.toContain('90250');
    expect(raw).not.toContain('my private message');
    expect(raw).not.toContain('free model output');
  });
});

describe('CompositeChatInterpretationShadowAuditSink', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the in-memory audit even when durable logging fails', () => {
    const inMemory = new InMemoryChatInterpretationShadowAuditStore();
    const durable = new StructuredLoggingChatInterpretationShadowAuditSink();
    jest.spyOn(durable, 'record').mockImplementation(() => {
      throw new Error('logging unavailable');
    });

    const sink = new CompositeChatInterpretationShadowAuditSink(inMemory, durable);
    expect(() => sink.record(baseRecord)).not.toThrow();
    expect(inMemory.snapshot()).toEqual([baseRecord]);
  });
}
);
