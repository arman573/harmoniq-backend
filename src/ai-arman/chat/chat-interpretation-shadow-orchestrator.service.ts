import { Injectable, Optional } from '@nestjs/common';
import {
  ChatInterpretationProvider,
  type AiArmanInterpretationProviderInput,
} from './chat-interpretation.provider';
import {
  ChatInterpretationShadowConfig,
} from './chat-interpretation-shadow.config';
import {
  ChatInterpretationShadowService,
  type ChatInterpretationShadowComparison,
} from './chat-interpretation-shadow.service';
import type { AiArmanInterpretation } from './chat-messages.types';

export type ChatInterpretationShadowRunResult =
  | {
      status: 'disabled';
      comparison: null;
    }
  | {
      status: 'provider_not_configured';
      comparison: null;
    }
  | {
      status: 'completed';
      comparison: ChatInterpretationShadowComparison;
    }
  | {
      status: 'provider_error';
      comparison: null;
    };

@Injectable()
export class ChatInterpretationShadowOrchestrator {
  constructor(
    private readonly config: ChatInterpretationShadowConfig,
    private readonly shadow: ChatInterpretationShadowService,
    @Optional()
    private readonly provider?: ChatInterpretationProvider,
  ) {}

  async run(
    deterministic: AiArmanInterpretation,
    input: AiArmanInterpretationProviderInput,
  ): Promise<ChatInterpretationShadowRunResult> {
    if (!this.config.isEnabled()) {
      return { status: 'disabled', comparison: null };
    }

    if (!this.provider) {
      return { status: 'provider_not_configured', comparison: null };
    }

    try {
      const candidate = await this.provider.interpret(input);
      return {
        status: 'completed',
        comparison: this.shadow.compare(deterministic, candidate),
      };
    } catch {
      return { status: 'provider_error', comparison: null };
    }
  }
}
