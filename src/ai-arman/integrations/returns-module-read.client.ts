import { Injectable } from '@nestjs/common';
import {
  parseReturnsModuleCaseContextResponse,
  validateReturnsModuleCaseContextRequest,
} from './returns-module-contract.validator';
import { readReturnsModuleReadConfig } from './returns-module-read.config';
import {
  ReturnsModuleCaseContextRequest,
  ReturnsModuleCaseContextResponse,
} from './returns-module.types';

export type ReturnsModuleReadResult =
  | {
      ok: true;
      configured: true;
      durationMs: number;
      response: ReturnsModuleCaseContextResponse;
      upstreamStatus: number;
    }
  | {
      ok: false;
      configured: boolean;
      durationMs: number;
      upstreamStatus?: number;
      error:
        | 'returns_module_read_disabled'
        | 'returns_module_base_url_not_configured'
        | 'returns_module_base_url_invalid'
        | 'returns_module_access_token_not_configured'
        | 'returns_module_request_invalid'
        | 'returns_module_timeout'
        | 'returns_module_request_failed'
        | 'returns_module_upstream_error'
        | 'returns_module_contract_invalid';
    };

@Injectable()
export class ReturnsModuleReadClient {
  async getCaseContext(
    request: ReturnsModuleCaseContextRequest,
  ): Promise<ReturnsModuleReadResult> {
    const connection = readReturnsModuleReadConfig();
    if (!connection.ok) {
      return {
        ok: false,
        configured: false,
        durationMs: 0,
        error: connection.error,
      };
    }

    if (!validateReturnsModuleCaseContextRequest(request)) {
      return {
        ok: false,
        configured: true,
        durationMs: 0,
        error: 'returns_module_request_invalid',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), connection.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(
        `${connection.baseUrl}/api/internal/ai-arman/cases/context`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${connection.accessToken}`,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        },
      );

      const durationMs = Date.now() - startedAt;

      let rawBody: unknown;
      try {
        rawBody = await response.json();
      } catch {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: response.ok
            ? 'returns_module_contract_invalid'
            : 'returns_module_upstream_error',
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: 'returns_module_upstream_error',
        };
      }

      const parsed = parseReturnsModuleCaseContextResponse(
        rawBody,
        request.orderId,
      );
      if (!parsed) {
        return {
          ok: false,
          configured: true,
          durationMs,
          upstreamStatus: response.status,
          error: 'returns_module_contract_invalid',
        };
      }

      return {
        ok: true,
        configured: true,
        durationMs,
        response: parsed,
        upstreamStatus: response.status,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const timedOut = error instanceof Error && error.name === 'AbortError';
      return {
        ok: false,
        configured: true,
        durationMs,
        error: timedOut
          ? 'returns_module_timeout'
          : 'returns_module_request_failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
