import { Injectable } from '@nestjs/common';

export type VerifiedOrderOwnership =
  | {
      ok: true;
      subject: string;
      verifiedOrderIds: string[];
    }
  | {
      ok: false;
      error: 'verification_unavailable' | 'verification_rejected';
    };

export type OrderEmailOtpProof = {
  verificationAttemptId: string;
  code: string;
  orderId: string;
};

export type AccountOrderAssertion = {
  authenticatedSubject: string;
  orderId: string;
};

export abstract class OrderEmailOtpVerificationProvider {
  abstract verify(proof: OrderEmailOtpProof): Promise<VerifiedOrderOwnership>;
}

export abstract class AccountOrderVerificationProvider {
  abstract verify(
    assertion: AccountOrderAssertion,
  ): Promise<VerifiedOrderOwnership>;
}

@Injectable()
export class DisabledOrderEmailOtpVerificationProvider
  extends OrderEmailOtpVerificationProvider
{
  async verify(): Promise<VerifiedOrderOwnership> {
    return { ok: false, error: 'verification_unavailable' };
  }
}

@Injectable()
export class DisabledAccountOrderVerificationProvider
  extends AccountOrderVerificationProvider
{
  async verify(): Promise<VerifiedOrderOwnership> {
    return { ok: false, error: 'verification_unavailable' };
  }
}
