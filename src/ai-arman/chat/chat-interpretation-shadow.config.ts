import { Injectable } from '@nestjs/common';

const DEFAULT_PROVIDER_TIMEOUT_MS = 1500;
const DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE = 30;

export abstract class ChatInterpretationShadowConfig {
  abstract isEnabled(): boolean;

  providerTimeoutMs(): number {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  maxProviderCallsPerMinute(): number {
    return DEFAULT_MAX_PROVIDER_CALLS_PER_MINUTE;
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
