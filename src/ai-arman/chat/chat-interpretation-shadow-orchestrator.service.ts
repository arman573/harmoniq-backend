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
      status: 'provider_timeout';
      comparison: null;
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
      const candidate = await withTimeout(
        this.provider.interpret(input),
        this.config.providerTimeoutMs(),
      );
      return {
        status: 'completed',
        comparison: this.shadow.compare(deterministic, candidate),
      };
    } catch (error) {
      if (error instanceof ShadowProviderTimeoutError) {
        return { status: 'provider_timeout', comparison: null };
      }
      return { status: 'provider_error', comparison: null };
    }
  }
}

class ShadowProviderTimeoutError extends Error {
  constructor() {
    super('shadow_provider_timeout');
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new ShadowProviderTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
