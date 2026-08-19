import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';

type SessionPayload = {
  v: 1;
  sub: string;
  exp: number;
};

@Injectable()
export class AiArmanCustomerSessionService {
  constructor(private readonly config: AiArmanCustomerWidgetConfig) {}

  issue(subject: string, now = Date.now()): string | null {
    const secret = this.config.sessionSecret();
    if (!secret) return null;

    const payload: SessionPayload = {
      v: 1,
      sub: subject,
      exp: now + this.config.sessionTtlMs(),
    };
    const encoded = base64Url(JSON.stringify(payload));
    const signature = sign(encoded, secret);
    return `${encoded}.${signature}`;
  }

  verify(token: string, now = Date.now()): SessionPayload | null {
    const secret = this.config.sessionSecret();
    if (!secret || typeof token !== 'string') return null;

    const [encoded, providedSignature, extra] = token.split('.');
    if (!encoded || !providedSignature || extra) return null;

    const expected = sign(encoded, secret);
    const left = Buffer.from(providedSignature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionPayload>;
      if (
        parsed.v !== 1 ||
        typeof parsed.sub !== 'string' ||
        !parsed.sub ||
        typeof parsed.exp !== 'number' ||
        !Number.isFinite(parsed.exp) ||
        parsed.exp <= now
      ) {
        return null;
      }
      return parsed as SessionPayload;
    } catch {
      return null;
    }
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
