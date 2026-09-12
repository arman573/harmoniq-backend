import { Injectable } from '@nestjs/common';
import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import { VendreOrderReadClient } from './vendre-order-read.client';
import type { VendreOrderReadResult } from './vendre-order-read.types';

export type VerifiedOrderReadInput = {
  conversationId: string;
  userId: number;
  orderId: string;
};

export type VerifiedOrderReadFailure = {
  ok: false;
  error:
    | 'verification_not_found'
    | 'verification_expired'
    | 'verification_actor_mismatch'
    | 'verification_order_mismatch';
};

@Injectable()
export class VerifiedOrderReadService {
  constructor(
    private readonly conversationVerificationStore: ConversationCustomerVerificationStore,
    private readonly verifiedCustomerContextStore: VerifiedCustomerContextStore,
    private readonly orderReadClient: VendreOrderReadClient,
  ) {}

  async getOrder(
    input: VerifiedOrderReadInput,
  ): Promise<VendreOrderReadResult | VerifiedOrderReadFailure> {
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

    return this.orderReadClient.getOrder(input.orderId);
  }
}
