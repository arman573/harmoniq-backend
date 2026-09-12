import { Injectable } from '@nestjs/common';
import { VerifiedCustomerContextStore } from './verified-customer-context.store';
import {
  AccountOrderAssertion,
  AccountOrderVerificationProvider,
  OrderEmailOtpProof,
  OrderEmailOtpVerificationProvider,
} from './customer-identity-verification.providers';
import { ReturnsModuleVerifiedCustomerContext } from '../integrations/returns-module.types';

const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;

export type CustomerIdentityVerificationResult =
  | {
      ok: true;
      context: ReturnsModuleVerifiedCustomerContext;
    }
  | {
      ok: false;
      error:
        | 'verification_unavailable'
        | 'verification_rejected'
        | 'verification_binding_invalid';
    };

@Injectable()
export class CustomerIdentityVerificationService {
  constructor(
    private readonly store: VerifiedCustomerContextStore,
    private readonly otpProvider: OrderEmailOtpVerificationProvider,
    private readonly accountProvider: AccountOrderVerificationProvider,
  ) {}

  async verifyOrderEmailOtp(
    proof: OrderEmailOtpProof,
    now = new Date(),
  ): Promise<CustomerIdentityVerificationResult> {
    const result = await this.otpProvider.verify(proof);
    return this.issueFromProviderResult(
      result,
      'order_email_otp',
      proof.orderId,
      now,
    );
  }

  async verifyAccountOrder(
    assertion: AccountOrderAssertion,
    now = new Date(),
  ): Promise<CustomerIdentityVerificationResult> {
    const result = await this.accountProvider.verify(assertion);
    return this.issueFromProviderResult(
      result,
      'account_assertion',
      assertion.orderId,
      now,
    );
  }

  private issueFromProviderResult(
    result: Awaited<ReturnType<OrderEmailOtpVerificationProvider['verify']>>,
    method: 'order_email_otp' | 'account_assertion',
    requestedOrderId: string,
    now: Date,
  ): CustomerIdentityVerificationResult {
    if (!result.ok) return result;

    const normalizedOrderId = String(requestedOrderId || '').trim();
    if (
      !ORDER_ID_PATTERN.test(normalizedOrderId) ||
      !Array.isArray(result.verifiedOrderIds) ||
      !result.verifiedOrderIds.includes(normalizedOrderId)
    ) {
      return { ok: false, error: 'verification_binding_invalid' };
    }

    try {
      return {
        ok: true,
        context: this.store.issue(
          {
            method,
            subject: result.subject,
            verifiedOrderIds: result.verifiedOrderIds,
          },
          now,
        ),
      };
    } catch {
      return { ok: false, error: 'verification_binding_invalid' };
    }
  }
}
