import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  CustomerDirectoryVerificationProvider,
  CustomerEmailOtpSender,
} from './ai-arman-customer-identity.providers';
import { AiArmanCustomerIdentityStore } from './ai-arman-customer-identity.store';
import { AiArmanCustomerSessionService } from './ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

@Injectable()
export class AiArmanCustomerIdentityService {
  constructor(
    private readonly config: AiArmanCustomerWidgetConfig,
    private readonly store: AiArmanCustomerIdentityStore,
    private readonly sender: CustomerEmailOtpSender,
    private readonly directory: CustomerDirectoryVerificationProvider,
    private readonly sessions: AiArmanCustomerSessionService,
  ) {}

  async start(emailInput: unknown, now = Date.now()) {
    if (!this.config.isWidgetEnabled() || !this.config.isIdentityEnabled()) {
      return { ok: false as const, code: 'identity_unavailable' as const };
    }

    const email = normalizeEmail(emailInput);
    if (!email) {
      return { ok: false as const, code: 'request_invalid' as const };
    }

    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const expiresAtMs = now + this.config.otpTtlMs();

    this.store.save({
      id,
      email,
      codeHash: hashCode(code, salt),
      expiresAtMs,
      attempts: 0,
    });

    const sent = await this.sender.send({
      email,
      code,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });

    if (!sent.ok) {
      this.store.delete(id);
      return { ok: false as const, code: 'identity_unavailable' as const };
    }

    return {
      ok: true as const,
      challengeId: id,
      expiresAt: new Date(expiresAtMs).toISOString(),
      message: 'Om adressen kan verifieras har en engångskod skickats.',
    };
  }

  async verify(input: {
    challengeId?: unknown;
    code?: unknown;
  }, now = Date.now()) {
    if (!this.config.isWidgetEnabled() || !this.config.isIdentityEnabled()) {
      return { ok: false as const, code: 'identity_unavailable' as const };
    }

    const challengeId = typeof input.challengeId === 'string' ? input.challengeId.trim() : '';
    const provided = typeof input.code === 'string' ? input.code.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !OTP_PATTERN.test(provided)) {
      return { ok: false as const, code: 'verification_rejected' as const };
    }

    const challenge = this.store.get(challengeId);
    if (!challenge || challenge.expiresAtMs <= now) {
      this.store.delete(challengeId);
      return { ok: false as const, code: 'verification_rejected' as const };
    }

    challenge.attempts += 1;
    if (challenge.attempts > this.config.maxOtpAttempts()) {
      this.store.delete(challengeId);
      return { ok: false as const, code: 'verification_rejected' as const };
    }

    const [salt, expectedDigest] = splitStoredHash(challenge.codeHash);
    const actualDigest = hashDigest(provided, salt);
    const left = Buffer.from(actualDigest);
    const right = Buffer.from(expectedDigest);
    const codeMatches = left.length === right.length && timingSafeEqual(left, right);

    if (!codeMatches) {
      this.store.update(challenge);
      return { ok: false as const, code: 'verification_rejected' as const };
    }

    const customer = await this.directory.verifyEmail(challenge.email);
    this.store.delete(challengeId);
    if (!customer.ok) {
      return { ok: false as const, code: 'verification_rejected' as const };
    }

    const sessionToken = this.sessions.issue(customer.subject, now);
    if (!sessionToken) {
      return { ok: false as const, code: 'identity_unavailable' as const };
    }

    return {
      ok: true as const,
      sessionToken,
      expiresAt: new Date(now + this.config.sessionTtlMs()).toISOString(),
    };
  }
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

function hashCode(code: string, salt: string): string {
  return `${salt}:${hashDigest(code, salt)}`;
}

function hashDigest(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function splitStoredHash(value: string): [string, string] {
  const index = value.indexOf(':');
  if (index <= 0) return ['', ''];
  return [value.slice(0, index), value.slice(index + 1)];
}
