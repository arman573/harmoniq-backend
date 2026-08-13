import { Injectable } from '@nestjs/common';
import { ConversationCustomerVerificationStore } from '../identity/conversation-customer-verification.store';
import { VerifiedCustomerContextStore } from '../identity/verified-customer-context.store';
import {
  GetCaseMessagesToolResult,
  GetCaseStatusToolResult,
  ReturnsModuleReadTools,
} from './returns-module-read.tools';

export type VerifiedReturnsReadInput = {
  conversationId: string;
  userId: number;
  orderId: string;
  caseId?: string;
};

export type VerifiedReturnsReadFailure = {
  ok: false;
  error:
    | 'verification_not_found'
    | 'verification_expired'
    | 'verification_actor_mismatch'
    | 'verification_order_mismatch';
};

@Injectable()
export class VerifiedReturnsReadService {
  constructor(
    private readonly conversationVerificationStore: ConversationCustomerVerificationStore,
    private readonly verifiedCustomerContextStore: VerifiedCustomerContextStore,
    private readonly returnsReadTools: ReturnsModuleReadTools,
  ) {}

  async getCaseStatus(
    input: VerifiedReturnsReadInput,
  ): Promise<GetCaseStatusToolResult | VerifiedReturnsReadFailure> {
    const verified = this.resolveVerifiedContext(input);
    if (!verified.ok) return verified;

    return this.returnsReadTools.getCaseStatus({
      verification: verified.context,
      orderId: input.orderId,
      ...(input.caseId ? { caseId: input.caseId } : {}),
    });
  }

  async getCaseMessages(
    input: VerifiedReturnsReadInput,
  ): Promise<GetCaseMessagesToolResult | VerifiedReturnsReadFailure> {
    const verified = this.resolveVerifiedContext(input);
    if (!verified.ok) return verified;

    return this.returnsReadTools.getCaseMessages({
      verification: verified.context,
      orderId: input.orderId,
      ...(input.caseId ? { caseId: input.caseId } : {}),
    });
  }

  private resolveVerifiedContext(input: VerifiedReturnsReadInput):
    | { ok: true; context: ReturnType<VerifiedCustomerContextStore['resolve']> extends infer T ? T extends { ok: true; context: infer C } ? C : never : never }
    | VerifiedReturnsReadFailure {
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

    return { ok: true, context: context.context };
  }
}
