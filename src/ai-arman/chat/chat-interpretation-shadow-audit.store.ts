import { Injectable } from '@nestjs/common';

const AUDIT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_AUDIT_RECORDS = 500;

export type ChatInterpretationShadowAuditRecord = {
  recordedAt: string;
  provider: string;
  modelVersion: string;
  promptVersion: string;
  status:
    | 'completed'
    | 'provider_rate_limited'
    | 'provider_timeout'
    | 'provider_error';
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  candidateValid: boolean | null;
  primaryIntentMatch: boolean | null;
};

type StoredAuditRecord = {
  record: ChatInterpretationShadowAuditRecord;
  expiresAt: number;
};

export abstract class ChatInterpretationShadowAuditSink {
  abstract record(record: ChatInterpretationShadowAuditRecord): void;
}

@Injectable()
export class InMemoryChatInterpretationShadowAuditStore
  extends ChatInterpretationShadowAuditSink
{
  private readonly records: StoredAuditRecord[] = [];

  record(record: ChatInterpretationShadowAuditRecord): void {
    const now = Date.now();
    this.pruneExpired(now);
    this.records.push({
      record: { ...record },
      expiresAt: now + AUDIT_TTL_MS,
    });
    this.enforceMaxSize();
  }

  snapshot(): ChatInterpretationShadowAuditRecord[] {
    this.pruneExpired(Date.now());
    return this.records.map(({ record }) => ({ ...record }));
  }

  private pruneExpired(now: number): void {
    while (this.records.length > 0 && this.records[0].expiresAt <= now) {
      this.records.shift();
    }
  }

  private enforceMaxSize(): void {
    while (this.records.length > MAX_AUDIT_RECORDS) {
      this.records.shift();
    }
  }
}
