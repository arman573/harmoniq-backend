import { Injectable } from '@nestjs/common';
import type { User } from '../../users/user.entity';
import { AuthenticatedAccountOrderAccessService } from '../identity/authenticated-account-order-access.service';
import type { TrackingReadResult } from '../integrations/tracking-read.types';
import type { VendreOrderReadResult } from '../integrations/vendre-order-read.types';
import type { VerifiedOrderReadFailure } from '../integrations/verified-order-read.service';
import { VerifiedOrderReadService } from '../integrations/verified-order-read.service';
import type { VerifiedTrackingReadFailure } from '../integrations/verified-tracking-read.service';
import { VerifiedTrackingReadService } from '../integrations/verified-tracking-read.service';
import { AuthenticatedAfterPurchaseChatOrchestrator } from './authenticated-after-purchase-chat-orchestrator.service';
import {
  ChatConversationResultRepository,
  ChatConversationStateRepository,
} from './chat-conversation.repositories';
import type {
  AiArmanChatRequest,
  AiArmanChatResponse,
} from './chat-messages.types';

type AuthenticatedChatUser = Pick<User, 'id' | 'email'>;
type OrderReadResult = VendreOrderReadResult | VerifiedOrderReadFailure;
type TrackingResult = TrackingReadResult | VerifiedTrackingReadFailure;
type RememberedOrderContext = {
  userId: number;
  orderId: string;
  expiresAtMs: number;
};

const ORDER_CONTEXT_TTL_MS = 30 * 60 * 1000;
const MAX_ORDER_CONTEXTS = 1000;

@Injectable()
export class AuthenticatedCustomerChatOrchestrator {
  private readonly orderContexts = new Map<string, RememberedOrderContext>();

  constructor(
    private readonly afterPurchase: AuthenticatedAfterPurchaseChatOrchestrator,
    private readonly accountOrderAccess: AuthenticatedAccountOrderAccessService,
    private readonly verifiedOrderRead: VerifiedOrderReadService,
    private readonly verifiedTrackingRead: VerifiedTrackingReadService,
    private readonly resultStore: ChatConversationResultRepository,
    private readonly stateStore: ChatConversationStateRepository,
  ) {}

  async handle(
    input: AiArmanChatRequest,
    user: AuthenticatedChatUser,
  ): Promise<AiArmanChatResponse> {
    const response = await this.afterPurchase.handle(input, user);
    if (
      alreadyHandledOrderRead(response) ||
      alreadyHandledReturnsRead(response) ||
      alreadyHandledTrackingRead(response)
    ) {
      return response;
    }

    const userId = Number(user?.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) return response;

    const remembered = this.resolveRememberedContext(
      response.conversationId,
      userId,
    );
    const explicitTracking =
      response.decision.route === 'order_support' &&
      response.interpretation.primaryIntent === 'tracking_status';
    const trackingFollowUp = isTrackingStatusFollowUp(input.message.text);

    if (explicitTracking || (remembered && trackingFollowUp)) {
      if (
        explicitTracking &&
        response.interpretation.missingFields.length > 0 &&
        !remembered
      ) {
        return response;
      }

      const explicitOrderId = explicitTracking
        ? response.interpretation.entities.orderReference
        : null;
      const orderId = explicitOrderId ?? remembered?.orderId ?? null;
      if (!orderId) return response;

      let tracking = await this.verifiedTrackingRead.getTracking({
        conversationId: response.conversationId,
        userId,
        orderId,
      });

      if (
        !tracking.ok &&
        (tracking.error === 'verification_not_found' ||
          tracking.error === 'verification_expired')
      ) {
        const verified = await this.accountOrderAccess.verifyAndBind({
          user: user as User,
          conversationId: response.conversationId,
          orderId,
        });
        if (!verified.ok) {
          return this.persist(
            input,
            applyTrackingVerificationFailure(response, verified.error),
          );
        }

        tracking = await this.verifiedTrackingRead.getTracking({
          conversationId: response.conversationId,
          userId,
          orderId,
        });
      }

      if (!tracking.ok) {
        return this.persist(input, applyTrackingReadFailure(response, tracking));
      }

      this.rememberContext(response.conversationId, { userId, orderId });
      return this.persist(input, applyTrackingReadSuccess(response, tracking));
    }

    const explicitOrderStatus =
      response.decision.route === 'order_support' &&
      response.interpretation.primaryIntent === 'order_status';
    const followUp = isOrderStatusFollowUp(input.message.text);

    if (!explicitOrderStatus && (!remembered || !followUp)) return response;
    if (explicitOrderStatus && response.interpretation.missingFields.length > 0) {
      return response;
    }

    const explicitOrderId = explicitOrderStatus
      ? response.interpretation.entities.orderReference
      : null;
    const orderId = explicitOrderId ?? remembered?.orderId ?? null;
    if (!orderId) return response;

    let order = await this.verifiedOrderRead.getOrder({
      conversationId: response.conversationId,
      userId,
      orderId,
    });

    if (
      !order.ok &&
      (order.error === 'verification_not_found' ||
        order.error === 'verification_expired')
    ) {
      const verified = await this.accountOrderAccess.verifyAndBind({
        user: user as User,
        conversationId: response.conversationId,
        orderId,
      });
      if (!verified.ok) {
        return this.persist(
          input,
          applyOrderVerificationFailure(response, verified.error),
        );
      }

      order = await this.verifiedOrderRead.getOrder({
        conversationId: response.conversationId,
        userId,
        orderId,
      });
    }

    if (!order.ok) {
      return this.persist(input, applyOrderReadFailure(response, order));
    }

    this.rememberContext(response.conversationId, { userId, orderId });
    return this.persist(input, applyOrderReadSuccess(response, order));
  }

  private rememberContext(
    conversationId: string,
    context: Omit<RememberedOrderContext, 'expiresAtMs'>,
    now = Date.now(),
  ): void {
    this.pruneExpiredContexts(now);
    this.orderContexts.delete(conversationId);
    this.orderContexts.set(conversationId, {
      ...context,
      expiresAtMs: now + ORDER_CONTEXT_TTL_MS,
    });
    while (this.orderContexts.size > MAX_ORDER_CONTEXTS) {
      const oldest = this.orderContexts.keys().next().value as string | undefined;
      if (!oldest) break;
      this.orderContexts.delete(oldest);
    }
  }

  private resolveRememberedContext(
    conversationId: string,
    userId: number,
    now = Date.now(),
  ): RememberedOrderContext | null {
    const context = this.orderContexts.get(conversationId);
    if (!context) return null;
    if (context.expiresAtMs <= now) {
      this.orderContexts.delete(conversationId);
      return null;
    }
    if (context.userId !== userId) return null;
    return { ...context };
  }

  private pruneExpiredContexts(now: number): void {
    for (const [key, context] of this.orderContexts) {
      if (context.expiresAtMs <= now) this.orderContexts.delete(key);
    }
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

function applyTrackingReadSuccess(
  response: AiArmanChatResponse,
  result: Extract<TrackingResult, { ok: true }>,
): AiArmanChatResponse {
  const tracking = result.tracking;
  const label =
    tracking.shipmentStatus ||
    tracking.message ||
    (tracking.deliveryType === 'pickup'
      ? 'Beställningen hämtas i salong.'
      : 'Paketspårning är tillgänglig.');
  const status =
    tracking.shipmentStatus ||
    (tracking.deliveryType === 'pickup' ? 'pickup' : 'available');

  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_tracking_status'],
      executionStatus: 'executed_read_only',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        'verified_tracking_read:tracking_status',
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: tracking.message || `Spårningsstatus för order ${tracking.orderId}: ${label}`,
      },
      {
        type: 'tracking_card',
        orderNumber: tracking.orderId,
        carrier: tracking.carrier,
        trackingStatus: status,
        trackingLabel: label,
        trackingUrl: tracking.trackingUrl,
        readAt: new Date().toISOString(),
      },
    ],
    safety: {
      ...response.safety,
      liveFactsUsed: true,
      writesExecuted: false,
      productionActionsEnabled: false,
    },
  };
}

function applyTrackingVerificationFailure(
  response: AiArmanChatResponse,
  error: string,
): AiArmanChatResponse {
  const rejected = error === 'verification_rejected';
  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_tracking_status'],
      executionStatus: 'failed_closed',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        `verified_tracking_read:${error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: rejected
          ? 'Jag kunde inte verifiera att den inloggade kunden äger den här ordern, så jag visar ingen spårningsinformation.'
          : 'Jag kan inte verifiera orderåtkomsten säkert just nu, så jag visar ingen spårningsinformation.',
      },
      {
        type: 'error_notice',
        code: rejected
          ? 'tracking_order_ownership_not_verified'
          : 'tracking_verification_temporarily_unavailable',
        text: rejected
          ? 'Orderägarskapet kunde inte verifieras.'
          : 'Orderverifieringen är inte tillgänglig just nu.',
        retryable: !rejected,
      },
    ],
  };
}

function applyTrackingReadFailure(
  response: AiArmanChatResponse,
  result: Exclude<TrackingResult, { ok: true }>,
): AiArmanChatResponse {
  const verificationError = [
    'verification_not_found',
    'verification_expired',
    'verification_actor_mismatch',
    'verification_order_mismatch',
  ].includes(result.error);
  const notFound = result.error === 'tracking_not_found';

  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_tracking_status'],
      executionStatus: notFound ? 'executed_read_only' : 'failed_closed',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        `verified_tracking_read:${result.error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: verificationError
          ? 'Jag kan inte använda den sparade orderverifieringen för den här förfrågan. Ingen spårningsinformation visas.'
          : notFound
            ? 'Ordern är verifierad, men det finns ingen aktiv paketspårning ännu.'
            : 'Jag kan inte läsa paketspårningen säkert just nu. Ingen osäker information visas.',
      },
      ...(!notFound
        ? [
            {
              type: 'error_notice' as const,
              code: verificationError
                ? 'verified_tracking_context_required'
                : 'tracking_status_temporarily_unavailable',
              text: verificationError
                ? 'Ordern behöver verifieras på nytt för den här konversationen.'
                : 'Paketspårningen är inte tillgänglig just nu.',
              retryable: true,
            },
          ]
        : []),
    ],
    safety: {
      ...response.safety,
      liveFactsUsed: notFound,
      writesExecuted: false,
      productionActionsEnabled: false,
    },
  };
}

function applyOrderReadSuccess(
  response: AiArmanChatResponse,
  result: Extract<OrderReadResult, { ok: true }>,
): AiArmanChatResponse {
  const order = result.order;
  const status = order.status || 'Okänd status';
  const dispatchText =
    order.dispatchState === 'dispatched'
      ? order.shippingDate
        ? ` Vendre visar skickad ${order.shippingDate}.`
        : ' Vendre visar att ordern är skickad.'
      : order.dispatchState === 'not_dispatched'
        ? ' Vendre visar ännu inte ordern som skickad.'
        : '';

  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_order'],
      executionStatus: 'executed_read_only',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        'verified_order_read:order_status',
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: `Order ${order.orderId} har status “${status}”.${dispatchText}`,
      },
    ],
    safety: {
      ...response.safety,
      liveFactsUsed: true,
      writesExecuted: false,
      productionActionsEnabled: false,
    },
  };
}

function applyOrderVerificationFailure(
  response: AiArmanChatResponse,
  error: string,
): AiArmanChatResponse {
  const rejected = error === 'verification_rejected';
  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_order'],
      executionStatus: 'failed_closed',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        `verified_order_read:${error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: rejected
          ? 'Jag kunde inte verifiera att den inloggade kunden äger den här ordern, så jag visar ingen orderinformation.'
          : 'Jag kan inte verifiera orderåtkomsten säkert just nu, så jag visar ingen orderinformation.',
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

function applyOrderReadFailure(
  response: AiArmanChatResponse,
  result: Exclude<OrderReadResult, { ok: true }>,
): AiArmanChatResponse {
  const verificationError = [
    'verification_not_found',
    'verification_expired',
    'verification_actor_mismatch',
    'verification_order_mismatch',
  ].includes(result.error);
  const notFound = result.error === 'order_not_found';

  return {
    ...response,
    decision: {
      ...response.decision,
      route: 'order_support',
      plannedTools: ['get_order'],
      executionStatus: 'failed_closed',
      requiresIdentity: true,
      reasons: unique([
        ...response.decision.reasons,
        `verified_order_read:${result.error}`,
        'writes_remain_disabled',
      ]),
    },
    blocks: [
      {
        type: 'message',
        text: verificationError
          ? 'Jag kan inte använda den sparade orderverifieringen för den här förfrågan. Ingen orderinformation visas.'
          : notFound
            ? 'Orderåtkomsten är verifierad, men ordern kunde inte hittas i orderkällan.'
            : 'Jag kan inte läsa orderstatus säkert just nu. Ingen osäker information visas.',
      },
      ...(!notFound
        ? [
            {
              type: 'error_notice' as const,
              code: verificationError
                ? 'verified_order_context_required'
                : 'order_status_temporarily_unavailable',
              text: verificationError
                ? 'Ordern behöver verifieras på nytt för den här konversationen.'
                : 'Orderstatus är inte tillgänglig just nu.',
              retryable: true,
            },
          ]
        : []),
    ],
  };
}

function isTrackingStatusFollowUp(value: string): boolean {
  const normalized = normalizeFollowUp(value);
  if (!normalized) return false;
  return /^(?:har paketet kommit langre(?: nu)?|har den kommit langre(?: nu)?|var ar paketet(?: nu)?|nagot nytt med paketet|och paketet(?: nu)?|sparning(?: nu)?)[?.! ]*$/.test(
    normalized,
  );
}

function isOrderStatusFollowUp(value: string): boolean {
  const normalized = normalizeFollowUp(value);
  if (!normalized) return false;

  return /^(?:vad ar status(?: nu)?|har det hant nagot(?: nu)?|nagot nytt|hur gar det(?: med den)?|och nu|status nu)[?.! ]*$/.test(
    normalized,
  );
}

function normalizeFollowUp(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function alreadyHandledOrderRead(response: AiArmanChatResponse): boolean {
  return response.decision.reasons.some((reason) =>
    reason.startsWith('verified_order_read:'),
  );
}

function alreadyHandledReturnsRead(response: AiArmanChatResponse): boolean {
  return response.decision.reasons.some((reason) =>
    reason.startsWith('verified_returns_read:'),
  );
}

function alreadyHandledTrackingRead(response: AiArmanChatResponse): boolean {
  return response.decision.reasons.some((reason) =>
    reason.startsWith('verified_tracking_read:'),
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}