import { Injectable } from '@nestjs/common';

const DEFAULT_PROVIDER_TIMEOUT_MS = 1500;

export abstract class ChatInterpretationShadowConfig {
  abstract isEnabled(): boolean;

  providerTimeoutMs(): number {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
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
