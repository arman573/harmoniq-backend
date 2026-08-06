import { Injectable } from '@nestjs/common';

export abstract class ChatInterpretationShadowConfig {
  abstract isEnabled(): boolean;
}

@Injectable()
export class DisabledChatInterpretationShadowConfig
  extends ChatInterpretationShadowConfig
{
  isEnabled(): boolean {
    return false;
  }
}
