import { Injectable } from '@nestjs/common';
import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import { TrackingReadClient } from './tracking-read.client';
import type { TrackingReadResult } from './tracking-read.types';

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

    return this.trackingReadClient.getTracking(input.orderId);
  }
}
