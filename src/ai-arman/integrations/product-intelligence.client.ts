import { Injectable, Optional } from '@nestjs/common';
import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';
import { readProductIntelligenceConnectionConfig } from './product-intelligence-connection.config';
import {
  ProductIntelligenceAuditSink,
  type ProductIntelligenceAuditStatus,
} from './product-intelligence-observability.store';
import { redactProductIntelligenceResponseSecrets } from './product-intelligence-redaction';
import { parseProductIntelligenceBatchResponse } from './product-intelligence-response.validator';
import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  ProductIntelligenceBatchRequest,
  ProductIntelligenceLookupResult,
  ProductIntelligenceRequestProduct,
} from './product-intelligence.types';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PRODUCTS = 25;

@Injectable()
export class ProductIntelligenceClient {
  constructor(
    private readonly authProvider: ProductIntelligenceAuthProvider =
      new ProductIntelligenceAuthProvider(),
    @Optional()
    private readonly auditSink?: ProductIntelligenceAuditSink,
  ) {}

  async evaluate(
    message: string,
    products: ProductIntelligenceRequestProduct[],
  ): Promise<ProductIntelligenceLookupResult> {
    const connection = readProductIntelligenceConnectionConfig();
    if (!connection.ok) {
      this.recordAudit(
        connection.error === 'product_intelligence_auth_not_configured'
          ? 'auth_not_configured'
          : 'connection_not_configured',
        'unresolved',
        0,
        null,
      );
      return {
        ok: false,
        configured: false,
        durationMs: 0,
        analyses: [],
        error: connection.error,
      };
    }

    const auth = await this.authProvider.getHeaders(connection.auth);
    if (!auth.ok) {
      this.recordAudit('auth_failed', connection.auth.mode, 0, null);
      return {
        ok: false,
        configured: false,
        durationMs: 0,
        analyses: [],
        error: auth.error,
      };
    }

    const request: ProductIntelligenceBatchRequest = {
      contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
      customerNeed: { message: String(message || '').trim() },
      products: products.slice(0, MAX_PRODUCTS),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.readTimeout());
    const startedAt = Date.now();

    try {
      const response = await fetch(
        `${connection.baseUrl}/v1/ai-arman/product-intelligence/evaluate-batch`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...auth.headers,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );

      let rawBody: unknown;
      try {
        rawBody = redactProductIntelligenceResponseSecrets(
          await response.json(),
          auth.headers,
        );
      } catch {
        const durationMs = Date.now() - startedAt;
        const status = response.ok ? 'contract_invalid' : 'upstream_error';
        this.recordAudit(
          status,
          connection.auth.mode,
          durationMs,
          response.status,
        );
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          analyses: [],
          error: response.ok
            ? 'product_intelligence_contract_invalid'
            : 'product_intelligence_upstream_error',
        };
      }

      if (!response.ok) {
        const durationMs = Date.now() - startedAt;
        this.recordAudit(
          'upstream_error',
          connection.auth.mode,
          durationMs,
          response.status,
        );
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          analyses: [],
          error: 'product_intelligence_upstream_error',
        };
      }

      const body = parseProductIntelligenceBatchResponse(rawBody);
      if (!body) {
        const durationMs = Date.now() - startedAt;
        this.recordAudit(
          'contract_invalid',
          connection.auth.mode,
          durationMs,
          response.status,
        );
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          analyses: [],
          error: 'product_intelligence_contract_invalid',
        };
      }

      const durationMs = Date.now() - startedAt;
      this.recordAudit(
        'completed',
        connection.auth.mode,
        durationMs,
        response.status,
      );
      return {
        ok: true,
        configured: true,
        durationMs,
        upstreamStatus: response.status,
        analyses: body.analyses,
        engineVersion: body.engineVersion,
        generatedAt: body.generatedAt,
        verification: body.verification,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      this.recordAudit(
        timedOut ? 'request_timeout' : 'request_failed',
        connection.auth.mode,
        durationMs,
        null,
      );
      return {
        ok: false,
        configured: true,
        durationMs,
        analyses: [],
        error: timedOut
          ? 'product_intelligence_timeout'
          : 'product_intelligence_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private recordAudit(
    status: ProductIntelligenceAuditStatus,
    authMode: 'none' | 'google_metadata_identity_token' | 'unresolved',
    durationMs: number,
    upstreamStatus: number | null,
  ): void {
    if (!this.auditSink) return;

    try {
      this.auditSink.record({
        recordedAt: new Date().toISOString(),
        status,
        authMode,
        durationMs: Math.max(0, Math.trunc(durationMs)),
        upstreamStatus:
          upstreamStatus === null ? null : Math.trunc(upstreamStatus),
      });
    } catch {
      // Observability must never affect the customer-facing fail-closed path.
    }
  }

  private readTimeout(): number {
    const configured = Number(process.env.PRODUCT_INTELLIGENCE_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
    return Math.min(30000, Math.max(1000, configured));
  }
}
