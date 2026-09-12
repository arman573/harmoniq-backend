import { Injectable } from '@nestjs/common';
import {
  ReturnsAdminGatewayClient,
  type ReturnsAdminGatewayResult,
} from '../integrations/returns-admin-gateway.client';

const MAX_SUBJECT_LENGTH = 300;
const MAX_MESSAGE_LENGTH = 4000;

export type AiArmanAdminActionName =
  | 'case.read'
  | 'case.order_context.read'
  | 'case.customer_message.send'
  | 'case.pause'
  | 'case.complete';

export type AiArmanAdminActionResult = {
  ok: boolean;
  action: AiArmanAdminActionName;
  caseId: string;
  readOnly: boolean;
  executed: boolean;
  durationMs: number;
  data?: unknown;
  error?: string;
};

@Injectable()
export class AiArmanAdminActionService {
  constructor(private readonly gateway: ReturnsAdminGatewayClient) {}

  async readCase(caseId: string): Promise<AiArmanAdminActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    if (!normalizedCaseId) return invalid('case.read', caseId);

    const result = await this.gateway.execute({
      method: 'GET',
      path: '/api/cases',
      reason: `Read authoritative case ${normalizedCaseId}`,
    });
    if (!result.ok) return failed('case.read', normalizedCaseId, result);

    const cases = readCases(result.body);
    const item = cases.find(
      (candidate) => String(candidate.caseId || '').trim() === normalizedCaseId,
    );
    if (!item) {
      return {
        ok: false,
        action: 'case.read',
        caseId: normalizedCaseId,
        readOnly: true,
        executed: true,
        durationMs: result.durationMs,
        error: 'case_not_found',
      };
    }

    return {
      ok: true,
      action: 'case.read',
      caseId: normalizedCaseId,
      readOnly: true,
      executed: true,
      durationMs: result.durationMs,
      data: item,
    };
  }

  async readOrderContext(caseId: string): Promise<AiArmanAdminActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    if (!normalizedCaseId) return invalid('case.order_context.read', caseId);

    const result = await this.gateway.execute({
      method: 'GET',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/order-context`,
      reason: `Read authoritative live order and tracking context for ${normalizedCaseId}`,
    });
    if (!result.ok) {
      return failed('case.order_context.read', normalizedCaseId, result);
    }

    return {
      ok: true,
      action: 'case.order_context.read',
      caseId: normalizedCaseId,
      readOnly: true,
      executed: true,
      durationMs: result.durationMs,
      data: result.body,
    };
  }

  async sendCustomerMessage(
    caseId: string,
    subject: string,
    message: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanAdminActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    if (!normalizedCaseId) {
      return invalid('case.customer_message.send', caseId);
    }

    const normalizedSubject = normalizeText(subject, MAX_SUBJECT_LENGTH);
    const normalizedMessage = normalizeText(message, MAX_MESSAGE_LENGTH);
    if (!normalizedSubject || !normalizedMessage) {
      return {
        ok: false,
        action: 'case.customer_message.send',
        caseId: normalizedCaseId,
        readOnly: false,
        executed: false,
        durationMs: 0,
        error: 'invalid_customer_message',
      };
    }

    const result = await this.gateway.execute({
      method: 'POST',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/messages/send`,
      body: {
        subject: normalizedSubject,
        message: normalizedMessage,
      },
      reason: `Send explicitly approved customer message for ${normalizedCaseId}`,
      explicitAdminApproval,
    });
    if (!result.ok) {
      return failed('case.customer_message.send', normalizedCaseId, result);
    }

    return {
      ok: true,
      action: 'case.customer_message.send',
      caseId: normalizedCaseId,
      readOnly: false,
      executed: true,
      durationMs: result.durationMs,
      data: result.body,
    };
  }

  async pauseCase(
    caseId: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanAdminActionResult> {
    return this.setQueueState(
      'case.pause',
      caseId,
      'waiting',
      explicitAdminApproval,
    );
  }

  async completeCase(
    caseId: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanAdminActionResult> {
    return this.setQueueState(
      'case.complete',
      caseId,
      'completed',
      explicitAdminApproval,
    );
  }

  private async setQueueState(
    action: 'case.pause' | 'case.complete',
    caseId: string,
    queueState: 'waiting' | 'completed',
    explicitAdminApproval: boolean,
  ): Promise<AiArmanAdminActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    if (!normalizedCaseId) return invalid(action, caseId);

    const result = await this.gateway.execute({
      method: 'PATCH',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/work-queue`,
      body: { queueState },
      reason:
        action === 'case.pause'
          ? `Pause ${normalizedCaseId} after explicit admin instruction`
          : `Complete ${normalizedCaseId} after explicit admin instruction`,
      explicitAdminApproval,
    });
    if (!result.ok) return failed(action, normalizedCaseId, result);

    return {
      ok: true,
      action,
      caseId: normalizedCaseId,
      readOnly: false,
      executed: true,
      durationMs: result.durationMs,
      data: result.body,
    };
  }
}

function normalizeCaseId(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return /^HQR-[A-Z0-9-]{3,40}$/.test(normalized) ? normalized : '';
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function readCases(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value)) return [];
  const candidates = Array.isArray(value.cases)
    ? value.cases
    : isRecord(value.body) && Array.isArray(value.body.cases)
      ? value.body.cases
      : [];
  return candidates.filter(isRecord);
}

function invalid(
  action: AiArmanAdminActionName,
  caseId: unknown,
): AiArmanAdminActionResult {
  return {
    ok: false,
    action,
    caseId: String(caseId || '').trim(),
    readOnly: action.endsWith('.read'),
    executed: false,
    durationMs: 0,
    error: 'invalid_case_id',
  };
}

function failed(
  action: AiArmanAdminActionName,
  caseId: string,
  result: Extract<ReturnsAdminGatewayResult, { ok: false }>,
): AiArmanAdminActionResult {
  return {
    ok: false,
    action,
    caseId,
    readOnly: action.endsWith('.read'),
    executed: result.durationMs > 0 || result.upstreamStatus !== undefined,
    durationMs: result.durationMs,
    error: result.error,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
