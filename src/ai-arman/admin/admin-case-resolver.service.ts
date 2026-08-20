import { Injectable } from '@nestjs/common';
import {
  AiArmanAdminActionService,
  type AiArmanAdminActionResult,
} from './admin-action.service';
import { AiArmanAdminCaseAssistantFastService } from './admin-case-assistant-fast.service';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';
import {
  AiArmanAdminReturnResolutionActionsService,
  type AiArmanReturnResolutionActionResult,
} from './admin-return-resolution-actions.service';

export type AiArmanResolverExecuteAction =
  | 'case.customer_message.send'
  | 'case.pause'
  | 'case.complete'
  | 'case.return_status.set'
  | 'case.product_decision.set'
  | 'case.return_label.create';

@Injectable()
export class AiArmanAdminCaseResolverService {
  constructor(
    private readonly actions: AiArmanAdminActionService,
    private readonly returnActions: AiArmanAdminReturnResolutionActionsService,
    private readonly assistant: AiArmanAdminCaseAssistantFastService,
    private readonly replyDraft: AiArmanAdminReplyDraftService,
  ) {}

  async prepare(input: unknown) {
    const caseId = readCaseId(input);
    if (!caseId) {
      return { ok: false as const, code: 'invalid_resolver_case_id' };
    }

    const caseResult = await this.actions.readCase(caseId);
    if (!caseResult.ok || !isRecord(caseResult.data)) {
      return {
        ok: false as const,
        code: 'resolver_case_read_failed',
        caseId,
        error: caseResult.error || 'case_unavailable',
        executesWrites: false,
      };
    }

    const authoritativeCase = caseResult.data;
    const orderContextResult = await this.actions.readOrderContext(caseId);
    const assistantInput = buildAssistantInput(authoritativeCase, orderContextResult);

    const [analysis, draft] = await Promise.all([
      this.assistant.assist(assistantInput).catch(() => ({
        ok: false as const,
        code: 'resolver_analysis_unavailable',
      })),
      this.replyDraft.createDraft(buildReplyInput(authoritativeCase)).catch(() => ({
        ok: false as const,
        code: 'resolver_reply_draft_unavailable',
      })),
    ]);

    return {
      ok: true as const,
      mode: 'prepare' as const,
      caseId,
      verifiedCase: true,
      verifiedOrderContext: orderContextResult.ok,
      caseSnapshot: projectCaseSnapshot(authoritativeCase),
      analysis: isSuccessfulAnalysis(analysis)
        ? {
            caseSummary: analysis.caseSummary,
            customerNeed: analysis.customerNeed,
            recommendedActions: analysis.recommendedActions,
            reasoning: analysis.reasoning,
            requiresHumanDecision: analysis.requiresHumanDecision,
            missingFacts: analysis.missingFacts,
          }
        : null,
      analysisStatus: analysis.ok === true ? 'available' : readCode(analysis),
      draft: isSuccessfulDraft(draft)
        ? {
            subject: `Angående ditt ärende ${caseId}`,
            message: draft.draftText,
            requiresHumanDecision: draft.requiresHumanDecision,
            decisionReasons: draft.decisionReasons,
            confidence: draft.confidence,
          }
        : null,
      draftStatus: draft.ok === true ? 'available' : readCode(draft),
      availableActions: [
        {
          action: 'case.customer_message.send' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: false,
        },
        {
          action: 'case.pause' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: false,
        },
        {
          action: 'case.complete' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: false,
        },
        {
          action: 'case.return_status.set' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: true,
        },
        {
          action: 'case.product_decision.set' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: true,
        },
        {
          action: 'case.return_label.create' as const,
          requiresExplicitApproval: true,
          requiresHumanDecision: true,
        },
      ],
      sendsCustomerMessage: false,
      executesWrites: false,
    };
  }

  async execute(input: unknown) {
    const normalized = normalizeExecuteInput(input);
    if (!normalized) {
      return {
        ok: false as const,
        code: 'invalid_resolver_execute_request',
        writeExecuted: false,
      };
    }
    if (!normalized.approved) {
      return {
        ok: false as const,
        code: 'resolver_explicit_approval_required',
        caseId: normalized.caseId,
        action: normalized.action,
        writeExecuted: false,
      };
    }

    const result = await this.executeAction(normalized);
    if (!result.ok) {
      return {
        ok: false as const,
        code: 'resolver_action_failed',
        caseId: normalized.caseId,
        action: normalized.action,
        error: result.error || 'action_failed',
        writeExecuted: result.executed,
      };
    }

    const readBack = await this.actions.readCase(normalized.caseId);
    return {
      ok: true as const,
      mode: 'execute' as const,
      caseId: normalized.caseId,
      action: normalized.action,
      writeExecuted: true,
      verifiedAfterWrite: readBack.ok,
      caseSnapshot:
        readBack.ok && isRecord(readBack.data)
          ? projectCaseSnapshot(readBack.data)
          : null,
      verificationError: readBack.ok ? null : readBack.error || 'read_back_failed',
    };
  }

  private executeAction(
    input: NormalizedExecuteInput,
  ): Promise<AiArmanAdminActionResult | AiArmanReturnResolutionActionResult> {
    switch (input.action) {
      case 'case.customer_message.send':
        return this.actions.sendCustomerMessage(
          input.caseId,
          input.subject,
          input.message,
          true,
        );
      case 'case.pause':
        return this.actions.pauseCase(input.caseId, true);
      case 'case.complete':
        return this.actions.completeCase(input.caseId, true);
      case 'case.return_status.set':
        return this.returnActions.setReturnStatus(
          input.caseId,
          input.status,
          input.note,
          true,
        );
      case 'case.product_decision.set':
        return this.returnActions.setProductDecision(
          input.caseId,
          input.productIndex,
          input.decision,
          input.rejectReason,
          input.adminNote,
          true,
        );
      case 'case.return_label.create':
        return this.returnActions.createReturnLabel(input.caseId, true);
    }
  }
}

type NormalizedExecuteInput =
  | {
      caseId: string;
      approved: boolean;
      action: 'case.customer_message.send';
      subject: string;
      message: string;
    }
  | {
      caseId: string;
      approved: boolean;
      action: 'case.pause' | 'case.complete' | 'case.return_label.create';
    }
  | {
      caseId: string;
      approved: boolean;
      action: 'case.return_status.set';
      status: string;
      note: string;
    }
  | {
      caseId: string;
      approved: boolean;
      action: 'case.product_decision.set';
      productIndex: number;
      decision: string;
      rejectReason: string;
      adminNote: string;
    };

function normalizeExecuteInput(value: unknown): NormalizedExecuteInput | null {
  if (!isRecord(value)) return null;
  const caseId = normalizeCaseId(value.caseId);
  const approved = value.approved === true;
  if (!caseId) return null;

  if (
    value.action === 'case.pause' ||
    value.action === 'case.complete' ||
    value.action === 'case.return_label.create'
  ) {
    return { caseId, approved, action: value.action };
  }

  if (value.action === 'case.customer_message.send') {
    const subject = clean(value.subject, 300);
    const message = clean(value.message, 4000);
    if (!subject || !message) return null;
    return {
      caseId,
      approved,
      action: 'case.customer_message.send',
      subject,
      message,
    };
  }

  if (value.action === 'case.return_status.set') {
    const status = clean(value.status, 80);
    if (!status) return null;
    return {
      caseId,
      approved,
      action: 'case.return_status.set',
      status,
      note: clean(value.note, 500),
    };
  }

  if (value.action === 'case.product_decision.set') {
    const productIndex = Number(value.productIndex);
    const decision = clean(value.decision, 40);
    if (!Number.isInteger(productIndex) || productIndex < 0 || !decision) return null;
    return {
      caseId,
      approved,
      action: 'case.product_decision.set',
      productIndex,
      decision,
      rejectReason: clean(value.rejectReason, 500),
      adminNote: clean(value.adminNote, 500),
    };
  }

  return null;
}

function readCaseId(value: unknown): string {
  return isRecord(value) ? normalizeCaseId(value.caseId) : '';
}

function normalizeCaseId(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return /^HQR-[A-Z0-9-]{3,40}$/.test(normalized) ? normalized : '';
}

function buildAssistantInput(
  item: Record<string, unknown>,
  orderContext: AiArmanAdminActionResult,
) {
  const messages = readMessages(item.messages);
  const orderFacts = orderContext.ok ? projectOrderContext(orderContext.data) : null;
  if (orderFacts) {
    messages.push({
      direction: 'system',
      sender: 'VERIFIERADE ORDERFAKTA',
      subject: 'Verifierad order- och leveranskontext',
      text: JSON.stringify(orderFacts),
      date: new Date().toISOString(),
    });
  }

  return {
    caseId: clean(item.caseId, 80),
    caseType: clean(item.type || item.caseType, 80) || 'support',
    status: clean(item.status, 120),
    customerName: readCustomerName(item),
    messages,
    discussion: [],
  };
}

function buildReplyInput(item: Record<string, unknown>) {
  return {
    caseId: clean(item.caseId, 80),
    caseType: clean(item.type || item.caseType, 80),
    status: clean(item.status, 120),
    statusLabel: clean(item.statusLabel, 180),
    customerName: readCustomerName(item),
    messages: readMessages(item.messages),
  };
}

function readMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .slice(-30)
    .map((message) => ({
      direction: clean(message.direction, 20),
      sender: clean(message.sender || message.senderName || message.from, 80),
      subject: clean(message.subject, 300),
      text: clean(message.text || message.message || message.body, 2400),
      date: clean(message.date || message.createdAt || message.timestamp, 64),
    }))
    .filter((message) => message.text || message.subject);
}

function projectOrderContext(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const projected: Record<string, unknown> = {};
  const keys = [
    'orderId',
    'orderNumber',
    'status',
    'statusLabel',
    'dispatchState',
    'shippingMethod',
    'trackingNumber',
    'carrier',
    'delivered',
  ];
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === 'string') {
      const text = clean(raw, 500);
      if (text) projected[key] = text;
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      projected[key] = raw;
    }
  }
  if (isRecord(value.tracking)) {
    projected.tracking = projectSimpleRecord(value.tracking, 12);
  }
  if (isRecord(value.shipping)) {
    projected.shipping = projectSimpleRecord(value.shipping, 12);
  }
  return Object.keys(projected).length ? projected : null;
}

function projectSimpleRecord(value: Record<string, unknown>, maxKeys: number) {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value).slice(0, maxKeys)) {
    if (raw === null || typeof raw === 'number' || typeof raw === 'boolean') {
      result[key] = raw;
    } else if (typeof raw === 'string') {
      result[key] = clean(raw, 500);
    }
  }
  return result;
}

function projectCaseSnapshot(item: Record<string, unknown>) {
  return {
    caseId: clean(item.caseId, 80),
    caseType: clean(item.type || item.caseType, 80),
    status: clean(item.status, 120),
    statusLabel: clean(item.statusLabel, 180),
    adminWorkQueueState: clean(item.adminWorkQueueState, 80),
    updatedAt: clean(item.updatedAt, 64),
    messageCount: Array.isArray(item.messages) ? item.messages.length : 0,
  };
}

function readCustomerName(item: Record<string, unknown>): string {
  const direct = clean(item.customerName, 120);
  if (direct) return direct;
  if (isRecord(item.customer)) {
    return clean(item.customer.name || item.customer.firstName, 120);
  }
  return '';
}

function clean(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email_redacted]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readCode(value: unknown): string {
  return isRecord(value) && typeof value.code === 'string'
    ? value.code
    : 'unavailable';
}

function isSuccessfulAnalysis(value: unknown): value is {
  ok: true;
  mode: 'analysis';
  caseSummary: string;
  customerNeed: string;
  recommendedActions: string[];
  reasoning: string;
  requiresHumanDecision: boolean;
  missingFacts: string[];
} {
  return isRecord(value) && value.ok === true && value.mode === 'analysis';
}

function isSuccessfulDraft(value: unknown): value is {
  ok: true;
  draftText: string;
  requiresHumanDecision: boolean;
  decisionReasons: string[];
  confidence: number;
} {
  return isRecord(value) && value.ok === true && typeof value.draftText === 'string';
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
