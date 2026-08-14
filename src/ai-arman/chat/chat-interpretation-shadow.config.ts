import { Injectable } from '@nestjs/common';

const DEFAULT_PROVIDER_TIMEOUT_MS = 1500;
const DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE = 30;
const DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS = 2;
const DEFAULT_MAX_PROVIDER_TOKENS_PER_CALL = 4096;
const DEFAULT_MAX_PROVIDER_TOKENS_PER_MINUTE = 30_000;
const DEFAULT_MAX_ESTIMATED_COST_USD_PER_CALL = 0.02;
const DEFAULT_MAX_ESTIMATED_COST_USD_PER_MINUTE = 0.1;

export const AI_ARMAN_MODEL_SHADOW_ENABLED_ENV = 'AI_ARMAN_MODEL_SHADOW_ENABLED';

export abstract class ChatInterpretationShadowConfig {
  abstract isEnabled(): boolean;

  providerTimeoutMs(): number {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  maxProviderCallsPerMinute(): number {
    return DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE;
  }

  maxConcurrentProviderCalls(): number {
    return DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS;
  }

  maxProviderTokensPerCall(): number {
    return DEFAULT_MAX_PROVIDER_TOKENS_PER_CALL;
  }

  maxProviderTokensPerMinute(): number {
    return DEFAULT_MAX_PROVIDER_TOKENS_PER_MINUTE;
  }

  maxEstimatedCostUsdPerCall(): number {
    return DEFAULT_MAX_ESTIMATED_COST_USD_PER_CALL;
  }

  maxEstimatedCostUsdPerMinute(): number {
    return DEFAULT_MAX_ESTIMATED_COST_USD_PER_MINUTE;
  }
}

@Injectable()
export class DisabledChatInterpretationShadowConfig
  extends ChatInterpretationShadowConfig
{
  isEnabled(): boolean {
    return false;
  }
}

@Injectable()
export class EnvChatInterpretationShadowConfig extends ChatInterpretationShadowConfig {
  isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_MODEL_SHADOW_ENABLED_ENV] === 'true';
  }

  providerTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
    return readIntegerEnv(
      env.AI_ARMAN_MODEL_SHADOW_PROVIDER_TIMEOUT_MS,
      DEFAULT_PROVIDER_TIMEOUT_MS,
      500,
      10_000,
    );
  }

  maxProviderCallsPerMinute(env: NodeJS.ProcessEnv = process.env): number {
    return readIntegerEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_CALLS_PER_MINUTE,
      DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE,
      1,
      300,
    );
  }

  maxConcurrentProviderCalls(env: NodeJS.ProcessEnv = process.env): number {
    return readIntegerEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_CONCURRENT_CALLS,
      DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS,
      1,
      20,
    );
  }

  maxProviderTokensPerCall(env: NodeJS.ProcessEnv = process.env): number {
    return readIntegerEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_CALL,
      DEFAULT_MAX_PROVIDER_TOKENS_PER_CALL,
      256,
      32_768,
    );
  }

  maxProviderTokensPerMinute(env: NodeJS.ProcessEnv = process.env): number {
    return readIntegerEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_MINUTE,
      DEFAULT_MAX_PROVIDER_TOKENS_PER_MINUTE,
      256,
      500_000,
    );
  }

  maxEstimatedCostUsdPerCall(env: NodeJS.ProcessEnv = process.env): number {
    return readNumberEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_CALL,
      DEFAULT_MAX_ESTIMATED_COST_USD_PER_CALL,
      0.001,
      1,
    );
  }

  maxEstimatedCostUsdPerMinute(env: NodeJS.ProcessEnv = process.env): number {
    return readNumberEnv(
      env.AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_MINUTE,
      DEFAULT_MAX_ESTIMATED_COST_USD_PER_MINUTE,
      0.001,
      10,
    );
  }
}

function readIntegerEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function readNumberEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
