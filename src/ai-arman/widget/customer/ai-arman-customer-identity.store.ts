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

  save(challenge: CustomerOtpChallenge, now = Date.now()): void {
    this.prune(now);
    this.challenges.set(challenge.id, { ...challenge });
  }

  get(id: string, now = Date.now()): CustomerOtpChallenge | null {
    this.prune(now);
    const value = this.challenges.get(id);
    return value ? { ...value } : null;
  }

  update(challenge: CustomerOtpChallenge): void {
    this.challenges.set(challenge.id, { ...challenge });
  }

  delete(id: string): void {
    this.challenges.delete(id);
  }

  private prune(now: number): void {
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAtMs <= now) this.challenges.delete(id);
    }
  }
}
