import { Injectable } from '@nestjs/common';
import type { User } from '../../users/user.entity';
import { AuthenticatedAccountOrderAccessService } from '../identity/authenticated-account-order-access.service';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat-conversation.repositories';
import type {
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanResponseBlock,
} from './chat-messages.types';
import type {
  GetCaseMessagesToolResult,
  GetCaseStatusToolResult,
} from '../integrations/returns-module-read.tools';
import type { VerifiedReturnsReadFailure } from '../integrations/verified-returns-read.service';
import { VerifiedReturnsReadService } from '../integrations/verified-returns-read.service';
import { SkincareSpecialistChatOrchestrator } from '../skincare/skincare-specialist-chat-orchestrator.service';

type AuthenticatedChatUser = Pick<User, 'id' | 'email'>;
type CaseStatusResult = GetCaseStatusToolResult | VerifiedReturnsReadFailure;
type CaseMessagesResult = GetCaseMessagesToolResult | VerifiedReturnsReadFailure;

@Injectable()
export class AuthenticatedAfterPurchaseChatOrchestrator {
  constructor(
    private readonly chat: SkincareSpecialistChatOrchestrator,
    private readonly accountOrderAccess: AuthenticatedAccountOrderAccessService,
    private readonly verifiedReturnsRead: VerifiedReturnsReadService,
    private readonly resultStore: ChatConversationResultRepository,
    private readonly stateStore: ChatConversationStateRepository,
  ) {}

  async handle(
    input: AiArmanChatRequest,
    user: AuthenticatedChatUser,
  ): Promise<AiArmanChatResponse> {
    const response = await this.chat.handleWithShadow(input);

    if (
      alreadyHandledReturnsRead(response) ||
      response.decision.route !== 'returns_support' ||
      !['return_help', 'claim_help'].includes(
        response.interpretation.primaryIntent,
      )
    ) {
      return response;
    }

    const orderId = response.interpretation.entities.orderReference;
    if (!orderId || response.interpretation.missingFields.length > 0) {
      return response;
    }

    const userId = Number(user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return this.persist(
        input,
        applyFailedClosed(response, 'authenticated_identity_invalid'),
      );
    }

    const caseId = extractCaseId(input.message.text);
    const readInput = {
      conversationId: response.conversationId,
      userId,
      orderId,
      ...(caseId ? { caseId } : {}),
    };

    let status = await this.verifiedReturnsRead.getCaseStatus(readInput);

    if (
      !status.ok &&
      (status.error === 'verification_not_found' ||
        status.error === 'verification_expired')
    ) {
      const verified = await this.accountOrderAccess.verifyAndBind({
        user: user as User,
        conversationId: response.conversationId,
        orderId,
      });

      if (!verified.ok) {
        return this.persist(
          input,
          applyVerificationFailure(response, verified.error),
        );
      }

      status = await this.verifiedReturnsRead.getCaseStatus(readInput);
    }

    if (!status.ok) {
      return this.persist(input, applyStatusFailure(response, status));
    }

    if (!requestsCaseMessages(input.message.text)) {
      return this.persist(input, applyStatusSuccess(response, status));
    }

    const messages = await this.verifiedReturnsRead.getCaseMessages({
      conversationId: response.conversationId,
      userId,
      orderId,
      caseId: status.caseId,
    });

    return this.persist(
      input,
      messages.ok
        ? applyMessagesSuccess(response, status, messages)
        : applyMessagesFailure(response, status, messages),
    );
  }

  private persist(
    input: AiArmanChatRequest,
    response: AiArmanChatResponse,
  ): AiArmanChatResponse {
    this.stateStore.save(response.state);

    const scope = input.conversationId?.trim() || 'new-conversation';
    const key = `${scope}:${input.clientMessageId.trim()}`;
    const stored = this.resultStore.get(key);
    if (!stored) return response;

    return this.resultStore.save(key, stored.fingerprint, response);
  }
}

function applyVerificationFailure(
  response: AiArmanChatResponse,
  error: string,
): AiArmanChatResponse {
  const rejected = error === 'verification_rejected';
  return {
    ...response,
    decision: {
      ...response.decision,
      plannedTools: ['get_case_status'],
      executionStatus: 'failed_closed',
      reasons: unique([
        ...response.decision.reasons,
        `verified_returns_read:${error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: rejected
          ? 'Jag kunde inte verifiera att den inloggade kunden äger den här ordern, så jag visar ingen ärendeinformation.'
          : 'Jag kan inte verifiera orderåtkomsten säkert just nu, så jag visar ingen ärendeinformation.',
      },
      {
        type: 'error_notice',
        code: rejected
          ? 'order_ownership_not_verified'
          : 'order_verification_temporarily_unavailable',
        text: rejected
          ? 'Orderägarskapet kunde inte verifieras.'
          : 'Orderverifieringen är inte tillgänglig just nu.',
        retryable: !rejected,
      },
    ],
  };
}

function applyStatusFailure(
  response: AiArmanChatResponse,
  result: Exclude<CaseStatusResult, { ok: true }>,
): AiArmanChatResponse {
  if (result.error === 'case_not_found') {
    return applyReadOnlyResult(response, 'case_not_found', [
      {
        type: 'message',
        text: 'Ordern är verifierad, men jag hittar inget befintligt retur- eller reklamationsärende som matchar.',
      },
    ]);
  }

  if (result.error === 'case_selection_ambiguous') {
    return applyReadOnlyResult(response, 'case_selection_ambiguous', [
      {
        type: 'message',
        text: 'Det finns flera ärenden på den här ordern. Skriv ärendenumret, till exempel HQR-123456, så läser jag rätt ärende utan att gissa.',
      },
    ]);
  }

  return applyFailedClosed(response, result.error);
}

function applyStatusSuccess(
  response: AiArmanChatResponse,
  status: Extract<CaseStatusResult, { ok: true }>,
): AiArmanChatResponse {
  return applyReadOnlyResult(response, 'case_status', [
    {
      type: 'message',
      text: `${caseTypeLabel(status.caseType)} ${status.caseId} har status “${status.statusLabel}”. Senast uppdaterat: ${status.updatedAt}.`,
    },
  ]);
}

function applyMessagesSuccess(
  response: AiArmanChatResponse,
  status: Extract<CaseStatusResult, { ok: true }>,
  messages: Extract<CaseMessagesResult, { ok: true }>,
): AiArmanChatResponse {
  const latest = messages.messages.slice(-10);
  const blocks: AiArmanResponseBlock[] = [
    {
      type: 'message',
      text: `${caseTypeLabel(status.caseType)} ${status.caseId} har status “${status.statusLabel}”.`,
    },
  ];

  if (latest.length === 0) {
    blocks.push({
      type: 'message',
      text: 'Det finns inga publika meddelanden i ärendet ännu.',
    });
  } else {
    blocks.push({
      type: 'message',
      text:
        messages.messages.length > latest.length
          ? `Här är de ${latest.length} senaste publika meddelandena i ärendet.`
          : 'Här är den publika meddelandehistoriken i ärendet.',
    });
    for (const message of latest) {
      const subject = message.subject.trim();
      blocks.push({
        type: 'message',
        text: [
          `${message.sender} · ${message.date}`,
          ...(subject ? [subject] : []),
          clampText(message.text, 1000),
        ].join('\n'),
      });
    }
  }

  return applyReadOnlyResult(response, 'case_messages', blocks);
}

function applyMessagesFailure(
  response: AiArmanChatResponse,
  status: Extract<CaseStatusResult, { ok: true }>,
  result: Exclude<CaseMessagesResult, { ok: true }>,
): AiArmanChatResponse {
  return {
    ...applyFailedClosed(response, result.error),
    blocks: [
      {
        type: 'message',
        text: `${caseTypeLabel(status.caseType)} ${status.caseId} har status “${status.statusLabel}”, men meddelandehistoriken kunde inte läsas säkert just nu.`,
      },
      {
        type: 'error_notice',
        code: 'case_messages_temporarily_unavailable',
        text: 'Ärendehistoriken kunde inte hämtas just nu.',
        retryable: true,
      },
    ],
  };
}

function applyReadOnlyResult(
  response: AiArmanChatResponse,
  reason: string,
  blocks: AiArmanResponseBlock[],
): AiArmanChatResponse {
  return {
    ...response,
    decision: {
      ...response.decision,
      plannedTools: ['get_case_status'],
      executionStatus: 'executed_read_only',
      reasons: unique([
        ...response.decision.reasons,
        `verified_returns_read:${reason}`,
        'writes_remain_disabled',
      ]),
    },
    blocks,
    safety: {
      ...response.safety,
      liveFactsUsed: true,
    },
  };
}

function applyFailedClosed(
  response: AiArmanChatResponse,
  error: string,
): AiArmanChatResponse {
  const verificationError = [
    'verification_not_found',
    'verification_expired',
    'verification_actor_mismatch',
    'verification_order_mismatch',
  ].includes(error);

  return {
    ...response,
    decision: {
      ...response.decision,
      plannedTools: ['get_case_status'],
      executionStatus: 'failed_closed',
      reasons: unique([
        ...response.decision.reasons,
        `verified_returns_read:${error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: verificationError
          ? 'Jag kan inte använda den sparade orderverifieringen för den här förfrågan. Ingen ärendeinformation visas.'
          : 'Jag kan inte läsa ärendet säkert just nu. Ingen osäker information visas.',
      },
      {
        type: 'error_notice',
        code: verificationError
          ? 'verified_order_context_required'
          : 'returns_module_temporarily_unavailable',
        text: verificationError
          ? 'Ordern behöver verifieras på nytt för den här konversationen.'
          : 'Retur- och reklamationsinformationen är inte tillgänglig just nu.',
        retryable: true,
      },
    ],
  };
}

function alreadyHandledReturnsRead(response: AiArmanChatResponse): boolean {
  return response.decision.reasons.some((reason) =>
    reason.startsWith('verified_returns_read:'),
  );
}

function extractCaseId(value: string): string | undefined {
  const match = String(value || '').match(/\bHQR-\d{6}\b/i);
  return match?.[0]?.toUpperCase();
}

function requestsCaseMessages(value: string): boolean {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return /meddeland|arendechat|chatt|historik|konversation|vad har (?:ni|jag) skrivit|senaste svar/.test(
    normalized,
  );
}

function caseTypeLabel(value: string): string {
  switch (value) {
    case 'return':
      return 'Returärende';
    case 'claim':
      return 'Reklamationsärende';
    case 'wrong_item':
      return 'Ärende om fel vara';
    case 'missing_item':
      return 'Ärende om saknad vara';
    default:
      return 'Ärende';
  }
}

function clampText(value: string, maxLength: number): string {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
