import { Injectable } from '@nestjs/common';
import {
  PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
  ProductIntelligenceBatchRequest,
  ProductIntelligenceBatchResponse,
  ProductIntelligenceLookupResult,
  ProductIntelligenceRequestProduct,
} from './product-intelligence.types';

const DEFAULT_TIMEOUT_MS = 1200;
const MAX_PRODUCTS = 25;

@Injectable()
export class ProductIntelligenceClient {
  async evaluate(
    message: string,
    products: ProductIntelligenceRequestProduct[],
  ): Promise<ProductIntelligenceLookupResult> {
    const baseUrl = String(process.env.PRODUCT_INTELLIGENCE_BASE_URL || '')
      .trim()
      .replace(/\/$/, '');

    if (!baseUrl) {
      return {
        ok: false,
        configured: false,
        durationMs: 0,
        analyses: [],
        error: 'product_intelligence_not_configured',
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
        `${baseUrl}/v1/ai-arman/product-intelligence/evaluate-batch`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );

      const body = (await response.json()) as ProductIntelligenceBatchResponse;

      if (!response.ok || body?.ok !== true) {
        return {
          ok: false,
          configured: true,
          durationMs: Date.now() - startedAt,
          upstreamStatus: response.status,
          analyses: [],
          error: 'product_intelligence_upstream_error',
        };
      }

      if (
        body.contractVersion !== PRODUCT_INTELLIGENCE_CONTRACT_VERSION
        || !Array.isArray(body.analyses)
      ) {
        return {
          ok: false,
          configured: true,
          durationMs: Date.now() - startedAt,
          upstreamStatus: response.status,
          analyses: [],
          error: 'product_intelligence_contract_invalid',
        };
      }

      return {
        ok: true,
        configured: true,
        durationMs: Date.now() - startedAt,
        upstreamStatus: response.status,
        analyses: body.analyses,
        engineVersion: body.engineVersion,
        generatedAt: body.generatedAt,
      };
    } catch (error) {
      return {
        ok: false,
        configured: true,
        durationMs: Date.now() - startedAt,
        analyses: [],
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'product_intelligence_timeout'
            : 'product_intelligence_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private readTimeout(): number {
    const configured = Number(process.env.PRODUCT_INTELLIGENCE_TIMEOUT_MS);
    if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
    return Math.min(3000, Math.max(300, configured));
  }
}
