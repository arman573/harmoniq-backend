import { Injectable } from '@nestjs/common';
import {
  ReturnsAdminGatewayClient,
  type ReturnsAdminGatewayResult,
} from '../integrations/returns-admin-gateway.client';

export const AI_ARMAN_RETURN_STATUSES = [
  'return_requested',
  'return_manual_review',
  'return_payment_pending',
  'return_label_pending',
  'return_label_sent',
  'return_own_shipping',
  'return_received',
  'return_under_review',
  'return_completed',
  'return_rejected',
  'return_reshipment_payment_pending',
  'return_reshipment_abandoned',
  'return_reshipment_order_created',
  'return_sent_back_to_customer',
] as const;

export type AiArmanReturnStatus = (typeof AI_ARMAN_RETURN_STATUSES)[number];
export type AiArmanProductDecision = 'pending' | 'approved' | 'rejected';
export type AiArmanReturnResolutionActionName =
  | 'case.return_status.set'
  | 'case.product_decision.set'
  | 'case.return_label.create';

export type AiArmanReturnResolutionActionResult = {
  ok: boolean;
  action: AiArmanReturnResolutionActionName;
  caseId: string;
  readOnly: false;
  executed: boolean;
  durationMs: number;
  data?: unknown;
  error?: string;
};

@Injectable()
export class AiArmanAdminReturnResolutionActionsService {
  constructor(private readonly gateway: ReturnsAdminGatewayClient) {}

  async setReturnStatus(
    caseId: string,
    status: string,
    note: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanReturnResolutionActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    const normalizedStatus = normalizeReturnStatus(status);
    if (!normalizedCaseId || !normalizedStatus) {
      return invalid('case.return_status.set', caseId, 'invalid_return_status');
    }

    const normalizedNote = clean(note, 500);
    const result = await this.gateway.execute({
      method: 'POST',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/status`,
      body: {
        status: normalizedStatus,
        ...(normalizedNote ? { note: normalizedNote } : {}),
      },
      reason: `Set explicitly approved return status ${normalizedStatus} for ${normalizedCaseId}`,
      explicitAdminApproval,
    });

    return projectGatewayResult(
      'case.return_status.set',
      normalizedCaseId,
      result,
    );
  }

  async setProductDecision(
    caseId: string,
    productIndex: number,
    decision: string,
    rejectReason: string,
    adminNote: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanReturnResolutionActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    const normalizedDecision = normalizeDecision(decision);
    if (
      !normalizedCaseId ||
      !Number.isInteger(productIndex) ||
      productIndex < 0 ||
      !normalizedDecision
    ) {
      return invalid(
        'case.product_decision.set',
        caseId,
        'invalid_product_decision',
      );
    }

    const normalizedRejectReason = clean(rejectReason, 500);
    const normalizedAdminNote = clean(adminNote, 500);
    if (normalizedDecision === 'rejected' && !normalizedRejectReason) {
      return invalid(
        'case.product_decision.set',
        normalizedCaseId,
        'reject_reason_required',
      );
    }

    const result = await this.gateway.execute({
      method: 'PATCH',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/products/${productIndex}/decision`,
      body: {
        decision: normalizedDecision,
        rejectReason:
          normalizedDecision === 'rejected' ? normalizedRejectReason : '',
        adminNote: normalizedAdminNote,
      },
      reason: `Set explicitly approved product decision ${normalizedDecision} for ${normalizedCaseId} product ${productIndex}`,
      explicitAdminApproval,
    });

    return projectGatewayResult(
      'case.product_decision.set',
      normalizedCaseId,
      result,
    );
  }

  async createReturnLabel(
    caseId: string,
    explicitAdminApproval: boolean,
  ): Promise<AiArmanReturnResolutionActionResult> {
    const normalizedCaseId = normalizeCaseId(caseId);
    if (!normalizedCaseId) {
      return invalid('case.return_label.create', caseId, 'invalid_case_id');
    }

    const result = await this.gateway.execute({
      method: 'POST',
      path: `/api/admin/cases/${encodeURIComponent(normalizedCaseId)}/return-label`,
      body: {},
      reason: `Create explicitly approved return label for ${normalizedCaseId} using authoritative Returns Module case data`,
      explicitAdminApproval,
    });

    return projectGatewayResult(
      'case.return_label.create',
      normalizedCaseId,
      result,
    );
  }
}

function normalizeCaseId(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return /^HQR-[A-Z0-9-]{3,40}$/.test(normalized) ? normalized : '';
}

function normalizeReturnStatus(value: unknown): AiArmanReturnStatus | '' {
  const normalized = String(value || '').trim();
  return (AI_ARMAN_RETURN_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as AiArmanReturnStatus)
    : '';
}

function normalizeDecision(value: unknown): AiArmanProductDecision | '' {
  const normalized = String(value || '').trim();
  return ['pending', 'approved', 'rejected'].includes(normalized)
    ? (normalized as AiArmanProductDecision)
    : '';
}

function clean(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function invalid(
  action: AiArmanReturnResolutionActionName,
  caseId: unknown,
  error: string,
): AiArmanReturnResolutionActionResult {
  return {
    ok: false,
    action,
    caseId: String(caseId || '').trim(),
    readOnly: false,
    executed: false,
    durationMs: 0,
    error,
  };
}

function projectGatewayResult(
  action: AiArmanReturnResolutionActionName,
  caseId: string,
  result: ReturnsAdminGatewayResult,
): AiArmanReturnResolutionActionResult {
  if (!result.ok) {
    return {
      ok: false,
      action,
      caseId,
      readOnly: false,
      executed: result.durationMs > 0 || result.upstreamStatus !== undefined,
      durationMs: result.durationMs,
      error: result.error,
    };
  }

  return {
    ok: true,
    action,
    caseId,
    readOnly: false,
    executed: true,
    durationMs: result.durationMs,
    data: result.body,
  };
}
