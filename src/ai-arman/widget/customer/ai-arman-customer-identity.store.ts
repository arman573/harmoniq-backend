import { Injectable } from '@nestjs/common';

export type CustomerOtpChallenge = {
  id: string;
  email: string;
  codeHash: string;
  expiresAtMs: number;
  attempts: number;
};

@Injectable()
export class AiArmanCustomerIdentityStore {
  private readonly challenges = new Map<string, CustomerOtpChallenge>();

  save(challenge: CustomerOtpChallenge): void {
    this.prune();
    this.challenges.set(challenge.id, { ...challenge });
  }

  get(id: string): CustomerOtpChallenge | null {
    this.prune();
    const value = this.challenges.get(id);
    return value ? { ...value } : null;
  }

  update(challenge: CustomerOtpChallenge): void {
    this.challenges.set(challenge.id, { ...challenge });
  }

  delete(id: string): void {
    this.challenges.delete(id);
  }

  private prune(now = Date.now()): void {
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAtMs <= now) this.challenges.delete(id);
    }
  }
}
