import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';

type SessionPayload = {
  v: 2;
  sub: string;
  exp: number;
};

const TOKEN_PREFIX = 'aia2';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class AiArmanCustomerSessionService {
  constructor(private readonly config: AiArmanCustomerWidgetConfig) {}

  issue(subject: string, now = Date.now()): string | null {
    const secret = this.config.sessionSecret();
    if (!secret || !subject) return null;

    const payload: SessionPayload = {
      v: 2,
      sub: subject,
      exp: now + this.config.sessionTtlMs(),
    };

    try {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      cipher.setAAD(Buffer.from(TOKEN_PREFIX, 'utf8'));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(payload), 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return [
        TOKEN_PREFIX,
        iv.toString('base64url'),
        ciphertext.toString('base64url'),
        tag.toString('base64url'),
      ].join('.');
    } catch {
      return null;
    }
  }

  verify(token: string, now = Date.now()): SessionPayload | null {
    const secret = this.config.sessionSecret();
    if (!secret || typeof token !== 'string') return null;

    const [prefix, encodedIv, encodedCiphertext, encodedTag, extra] = token.split('.');
    if (
      prefix !== TOKEN_PREFIX ||
      !encodedIv ||
      !encodedCiphertext ||
      !encodedTag ||
      extra
    ) {
      return null;
    }

    try {
      const iv = Buffer.from(encodedIv, 'base64url');
      const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
      const tag = Buffer.from(encodedTag, 'base64url');
      if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
        return null;
      }

      const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(TOKEN_PREFIX, 'utf8'));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
      const parsed = JSON.parse(plaintext) as Partial<SessionPayload>;

      if (
        parsed.v !== 2 ||
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

function deriveKey(secret: string): Buffer {
  return createHash('sha256')
    .update('ai-arman-customer-session-v2\u0000', 'utf8')
    .update(secret, 'utf8')
    .digest();
}
