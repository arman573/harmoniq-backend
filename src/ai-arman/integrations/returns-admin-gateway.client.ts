import { Injectable } from '@nestjs/common';
import { ProductIntelligenceAuthProvider } from './product-intelligence-auth.provider';
import { readReturnsAdminGatewayConfig } from './returns-admin-gateway.config';

export type ReturnsAdminGatewayRequest = {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  body?: unknown;
  reason: string;
  requestId?: string;
  explicitAdminApproval?: boolean;
};

export type ReturnsAdminGatewayResult =
  | {
      ok: true;
      configured: true;
      durationMs: number;
      upstreamStatus: number;
      requestId: string;
      method: string;
      path: string;
      contentType: string;
      body?: unknown;
      bodyBase64?: string;
      isWrite: boolean;
    }
  | {
      ok: false;
      configured: boolean;
      durationMs: number;
      upstreamStatus?: number;
      error:
        | 'returns_admin_gateway_disabled'
        | 'returns_admin_gateway_base_url_invalid'
        | 'returns_admin_gateway_audience_invalid'
        | 'returns_admin_gateway_access_token_not_configured'
        | 'returns_admin_gateway_write_disabled'
        | 'returns_admin_gateway_write_requires_approval'
        | 'returns_admin_gateway_identity_unavailable'
        | 'returns_admin_gateway_timeout'
        | 'returns_admin_gateway_request_failed'
        | 'returns_admin_gateway_upstream_error'
        | 'returns_admin_gateway_contract_invalid';
    };

@Injectable()
export class ReturnsAdminGatewayClient {
  constructor(
    private readonly authProvider: ProductIntelligenceAuthProvider =
      new ProductIntelligenceAuthProvider(),
  ) {}

  async execute(request: ReturnsAdminGatewayRequest): Promise<ReturnsAdminGatewayResult> {
    const config = readReturnsAdminGatewayConfig();
    if (!config.ok) {
      return {
        ok: false,
        configured: false,
        durationMs: 0,
        error: config.error,
      };
    }

    const isWrite = !['GET', 'HEAD'].includes(request.method);
    if (isWrite && !config.writeEnabled) {
      return {
        ok: false,
        configured: true,
        durationMs: 0,
        error: 'returns_admin_gateway_write_disabled',
      };
    }
    if (isWrite && request.explicitAdminApproval !== true) {
      return {
        ok: false,
        configured: true,
        durationMs: 0,
        error: 'returns_admin_gateway_write_requires_approval',
      };
    }

    const auth = await this.authProvider.getHeaders({
      mode: 'google_metadata_identity_token',
      audience: config.audience,
    });
    if (!auth.ok) {
      return {
        ok: false,
        configured: true,
        durationMs: 0,
        error: 'returns_admin_gateway_identity_unavailable',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(
        `${config.baseUrl}/api/internal/ai-arman/admin/execute`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...auth.headers,
            'X-AI-Arman-Admin-Token': config.accessToken,
          },
          body: JSON.stringify({
            method: request.method,
            path: request.path,
            ...(request.query ? { query: request.query } : {}),
            ...(request.body !== undefined ? { body: request.body } : {}),
            reason: request.reason,
            ...(request.requestId ? { requestId: request.requestId } : {}),
          }),
          redirect: 'error',
          signal: controller.signal,
        },
      );

      const durationMs = Date.now() - startedAt;
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: 'returns_admin_gateway_contract_invalid',
        };
      }

      if (!response.ok || !isRecord(body)) {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: 'returns_admin_gateway_upstream_error',
        };
      }

      const requestId = String(body.requestId || '').trim();
      const method = String(body.method || '').trim();
      const path = String(body.path || '').trim();
      const contentType = String(body.contentType || '').trim();
      const upstreamStatus = Number(body.upstreamStatus);
      if (
        body.ok !== true ||
        !requestId ||
        !method ||
        !path ||
        !contentType ||
        !Number.isInteger(upstreamStatus)
      ) {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: 'returns_admin_gateway_contract_invalid',
        };
      }

      return {
        ok: true,
        configured: true,
        durationMs,
        upstreamStatus,
        requestId,
        method,
        path,
        contentType,
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(typeof body.bodyBase64 === 'string' ? { bodyBase64: body.bodyBase64 } : {}),
        isWrite,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      return {
        ok: false,
        configured: true,
        durationMs,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'returns_admin_gateway_timeout'
            : 'returns_admin_gateway_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
