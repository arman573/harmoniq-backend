import { Injectable } from '@nestjs/common';

export const AI_ARMAN_CUSTOMER_WIDGET_ENABLED_ENV =
  'AI_ARMAN_CUSTOMER_WIDGET_ENABLED';
export const AI_ARMAN_CUSTOMER_IDENTITY_ENABLED_ENV =
  'AI_ARMAN_CUSTOMER_IDENTITY_ENABLED';
export const AI_ARMAN_CUSTOMER_SESSION_SECRET_ENV =
  'AI_ARMAN_CUSTOMER_SESSION_SECRET';

const DEFAULT_OTP_TTL_MS = 10 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AiArmanCustomerWidgetConfig {
  isWidgetEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_CUSTOMER_WIDGET_ENABLED_ENV] === 'true';
  }

  isIdentityEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_CUSTOMER_IDENTITY_ENABLED_ENV] === 'true';
  }

  sessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
    const value = String(env[AI_ARMAN_CUSTOMER_SESSION_SECRET_ENV] || '').trim();
    return value.length >= 32 ? value : null;
  }

  otpTtlMs(env: NodeJS.ProcessEnv = process.env): number {
    return readBoundedInteger(
      env.AI_ARMAN_CUSTOMER_OTP_TTL_MS,
      DEFAULT_OTP_TTL_MS,
      60_000,
      30 * 60 * 1000,
    );
  }

  sessionTtlMs(env: NodeJS.ProcessEnv = process.env): number {
    return readBoundedInteger(
      env.AI_ARMAN_CUSTOMER_SESSION_TTL_MS,
      DEFAULT_SESSION_TTL_MS,
      5 * 60 * 1000,
      12 * 60 * 60 * 1000,
    );
  }

  maxOtpAttempts(env: NodeJS.ProcessEnv = process.env): number {
    return readBoundedInteger(
      env.AI_ARMAN_CUSTOMER_OTP_MAX_ATTEMPTS,
      DEFAULT_MAX_OTP_ATTEMPTS,
      1,
      10,
    );
  }
}

function readBoundedInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
