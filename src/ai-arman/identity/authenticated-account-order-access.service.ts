import { Injectable } from '@nestjs/common';
import type { User } from '../../users/user.entity';
import { CustomerIdentityVerificationService } from './customer-identity-verification.service';
import { ConversationCustomerVerificationStore } from './conversation-customer-verification.store';

const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;

export type AuthenticatedAccountOrderAccessResult =
  | {
      ok: true;
      conversationId: string;
      orderId: string;
      expiresAt: string;
    }
  | {
      ok: false;
      error:
        | 'request_invalid'
        | 'authenticated_identity_invalid'
        | 'verification_unavailable'
        | 'verification_rejected'
        | 'verification_binding_invalid';
    };

@Injectable()
export class AuthenticatedAccountOrderAccessService {
  constructor(
    private readonly identityVerification: CustomerIdentityVerificationService,
    private readonly conversationVerificationStore: ConversationCustomerVerificationStore,
  ) {}

  async verifyAndBind(input: {
    user: User;
    conversationId: string;
    orderId: string;
    now?: Date;
  }): Promise<AuthenticatedAccountOrderAccessResult> {
    const conversationId = String(input.conversationId || '').trim();
    const orderId = String(input.orderId || '').trim();
    const userId = Number(input.user?.id);
    const authenticatedSubject = String(input.user?.email || '').trim();

    if (
      !CONVERSATION_ID_PATTERN.test(conversationId) ||
      !ORDER_ID_PATTERN.test(orderId)
    ) {
      return { ok: false, error: 'request_invalid' };
    }

    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !authenticatedSubject ||
      authenticatedSubject.length > 320
    ) {
      return { ok: false, error: 'authenticated_identity_invalid' };
    }

    const result = await this.identityVerification.verifyAccountOrder(
      {
        authenticatedSubject,
        orderId,
      },
      input.now,
    );

    if (!result.ok) return result;

    try {
      const binding = this.conversationVerificationStore.bind({
        conversationId,
        userId,
        orderId,
        verificationId: result.context.verificationId,
        expiresAt: result.context.expiresAt,
      });

      return {
        ok: true,
        conversationId: binding.conversationId,
        orderId: binding.orderId,
        expiresAt: binding.expiresAt,
      };
    } catch {
      return { ok: false, error: 'verification_binding_invalid' };
    }
  }
}
