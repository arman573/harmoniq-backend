import { Injectable } from '@nestjs/common';

export type CustomerEmailOtpSendResult =
  | { ok: true }
  | { ok: false; error: 'delivery_unavailable' };

export abstract class CustomerEmailOtpSender {
  abstract send(input: {
    email: string;
    code: string;
    expiresAt: string;
  }): Promise<CustomerEmailOtpSendResult>;
}

export type CustomerDirectoryVerificationResult =
  | { ok: true; subject: string }
  | {
      ok: false;
      error: 'verification_unavailable' | 'customer_not_found';
    };

export abstract class CustomerDirectoryVerificationProvider {
  abstract verifyEmail(email: string): Promise<CustomerDirectoryVerificationResult>;
}

@Injectable()
export class DisabledCustomerEmailOtpSender extends CustomerEmailOtpSender {
  async send(): Promise<CustomerEmailOtpSendResult> {
    return { ok: false, error: 'delivery_unavailable' };
  }
}

@Injectable()
export class DisabledCustomerDirectoryVerificationProvider extends CustomerDirectoryVerificationProvider {
  async verifyEmail(): Promise<CustomerDirectoryVerificationResult> {
    return { ok: false, error: 'verification_unavailable' };
  }
}
