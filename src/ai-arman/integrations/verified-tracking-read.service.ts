import { Injectable } from '@nestjs/common';
import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import { TrackingReadClient } from './tracking-read.client';
import type { TrackingReadOrder, TrackingReadResult } from './tracking-read.types';
import { VendreOrderReadClient } from './vendre-order-read.client';
import type { SafeVendreOrderRead } from './vendre-order-read.types';

export type VerifiedTrackingReadInput = {
  conversationId: string;
  userId: number;
  orderId: string;
};

export type VerifiedTrackingReadFailure = {
  ok: false;
  error:
    | 'verification_not_found'
    | 'verification_expired'
    | 'verification_actor_mismatch'
    | 'verification_order_mismatch';
};

@Injectable()
export class VerifiedTrackingReadService {
  constructor(
    private readonly conversationVerificationStore: ConversationCustomerVerificationStore,
    private readonly verifiedCustomerContextStore: VerifiedCustomerContextStore,
    private readonly trackingReadClient: TrackingReadClient,
    private readonly vendreOrderReadClient: VendreOrderReadClient,
  ) {}

  async getTracking(
    input: VerifiedTrackingReadInput,
  ): Promise<TrackingReadResult | VerifiedTrackingReadFailure> {
    const binding = this.conversationVerificationStore.resolve(
      input.conversationId,
      input.userId,
      input.orderId,
    );

    if (!binding.ok) {
      return {
        ok: false,
        error:
          binding.error === 'conversation_verification_expired'
            ? 'verification_expired'
            : binding.error === 'conversation_verification_actor_mismatch'
              ? 'verification_actor_mismatch'
              : binding.error === 'conversation_verification_order_mismatch'
                ? 'verification_order_mismatch'
                : 'verification_not_found',
      };
    }

    const context = this.verifiedCustomerContextStore.resolve(
      binding.binding.verificationId,
      input.orderId,
    );
    if (!context.ok) {
      return {
        ok: false,
        error:
          context.error === 'verification_expired'
            ? 'verification_expired'
            : context.error === 'verification_order_mismatch'
              ? 'verification_order_mismatch'
              : 'verification_not_found',
      };
    }

    const vendreOrder = await this.vendreOrderReadClient.getOrder(input.orderId);
    if (vendreOrder.ok) {
      const tracking = projectVendreTracking(vendreOrder.order);
      if (tracking) {
        return { ok: true, tracking };
      }
    }

    return this.trackingReadClient.getTracking(input.orderId);
  }
}

function projectVendreTracking(order: SafeVendreOrderRead): TrackingReadOrder | null {
  const parcelNo = cleanNullable(order.trackingNumber);
  const trackingUrl = cleanNullable(order.trackingUrl);
  if (!parcelNo && !trackingUrl) return null;

  const shipmentStatus = cleanNullable(order.shipmentStatus || order.status);
  const message = parcelNo
    ? `Vendre visar spårningsnummer ${parcelNo} för order ${order.orderId}.`
    : `Vendre har en spårningslänk för order ${order.orderId}.`;

  return {
    orderId: order.orderId,
    deliveryMethod: null,
    deliveryType: 'other',
    carrier: null,
    shipmentStatus,
    trackingUrl,
    parcelNo,
    available: true,
    message,
  };
}

function cleanNullable(value: string): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
