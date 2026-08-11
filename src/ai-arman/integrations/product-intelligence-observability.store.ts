import { Injectable } from '@nestjs/common';
import type { ProductIntelligenceResolvedAuthConfig } from './product-intelligence-connection.config';

const AUDIT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_AUDIT_RECORDS = 500;

export type ProductIntelligenceAuditStatus =
  | 'connection_not_configured'
  | 'auth_not_configured'
  | 'auth_failed'
  | 'request_timeout'
  | 'request_failed'
  | 'upstream_error'
  | 'contract_invalid'
  | 'completed';

export type ProductIntelligenceAuditRecord = {
  recordedAt: string;
  status: ProductIntelligenceAuditStatus;
  authMode: ProductIntelligenceResolvedAuthConfig['mode'] | 'unresolved';
  durationMs: number;
  upstreamStatus: number | null;
};

type StoredAuditRecord = {
  record: ProductIntelligenceAuditRecord;
  expiresAt: number;
};

export abstract class ProductIntelligenceAuditSink {
  abstract record(record: ProductIntelligenceAuditRecord): void;
}

@Injectable()
export class InMemoryProductIntelligenceAuditStore
  extends ProductIntelligenceAuditSink
{
  private readonly records: StoredAuditRecord[] = [];

  record(record: ProductIntelligenceAuditRecord): void {
    const now = Date.now();
    this.pruneExpired(now);
    this.records.push({
      record: { ...record },
      expiresAt: now + AUDIT_TTL_MS,
    });
    this.enforceMaxSize();
  }

  snapshot(): ProductIntelligenceAuditRecord[] {
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
