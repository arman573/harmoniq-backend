import { Injectable } from '@nestjs/common';
import {
  ChatInterpretationShadowAuditSink,
  InMemoryChatInterpretationShadowAuditStore,
  type ChatInterpretationShadowAuditRecord,
} from './chat-interpretation-shadow-audit.store';

export const AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV =
  'AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED';

const STRUCTURED_EVENT_NAME = 'ai_arman_model_shadow_audit';
const STRUCTURED_EVENT_SCHEMA_VERSION = 1;

@Injectable()
export class StructuredLoggingChatInterpretationShadowAuditSink extends ChatInterpretationShadowAuditSink {
  record(record: ChatInterpretationShadowAuditRecord): void {
    if (!this.isEnabled()) return;

    const payload = {
      severity: 'INFO',
      event: STRUCTURED_EVENT_NAME,
      schemaVersion: STRUCTURED_EVENT_SCHEMA_VERSION,
      recordedAt: record.recordedAt,
      provider: record.provider,
      modelVersion: record.modelVersion,
      promptVersion: record.promptVersion,
      status: record.status,
      latencyMs: record.latencyMs,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      estimatedCostUsd: record.estimatedCostUsd,
      candidateValid: record.candidateValid,
      primaryIntentMatch: record.primaryIntentMatch,
    };

    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  private isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_MODEL_SHADOW_DURABLE_AUDIT_ENABLED_ENV] === 'true';
  }
}

@Injectable()
export class CompositeChatInterpretationShadowAuditSink extends ChatInterpretationShadowAuditSink {
  constructor(
    private readonly inMemory: InMemoryChatInterpretationShadowAuditStore,
    private readonly durable: StructuredLoggingChatInterpretationShadowAuditSink,
  ) {
    super();
  }

  record(record: ChatInterpretationShadowAuditRecord): void {
    try {
      this.inMemory.record(record);
    } catch {
      // Audit storage must never affect the deterministic customer path.
    }

    try {
      this.durable.record(record);
    } catch {
      // Durable logging must remain non-blocking and fail-safe.
    }
  }
}
