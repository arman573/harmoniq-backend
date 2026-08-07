import { Injectable } from '@nestjs/common';

const DEFAULT_PROVIDER_TIMEOUT_MS = 1500;
const DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE = 30;
const DEFAULT_MAX_CONCURRENT_PROVIDER_CALLS = 2;
const DEFAULT_MAX_PROVIDER_TOKENS_PER_CALL = 4096;
const DEFAULT_MAX_PROVIDER_TOKENS_PER_MINUTE = 30_000;
const DEFAULT_MAX_ESTIMATED_COST_USD_PER_CALL = 0.02;
const DEFAULT_MAX_ESTIMATED_COST_USD_PER_MINUTE = 0.1;

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
