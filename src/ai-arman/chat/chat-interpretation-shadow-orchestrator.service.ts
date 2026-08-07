import { Injectable, Optional } from '@nestjs/common';
import {
  ChatInterpretationProvider,
  type AiArmanInterpretationProviderInput,
  type AiArmanInterpretationProviderResult,
  type AiArmanInterpretationProviderUsage,
} from './chat-interpretation.provider';
import {
  ChatInterpretationShadowConfig,
} from './chat-interpretation-shadow.config';
import {
  ChatInterpretationShadowService,
  type ChatInterpretationShadowComparison,
} from './chat-interpretation-shadow.service';
import type { AiArmanInterpretation } from './chat-messages.types';

const RATE_LIMIT_WINDOW_MS = 60_000;

export type ChatInterpretationShadowUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
};

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
      usage: ChatInterpretationShadowUsage;
    }
  | {
      status: 'provider_rate_limited';
      comparison: null;
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
  private readonly providerCallTimes: number[] = [];

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

    if (!this.reserveProviderCall(Date.now())) {
      return { status: 'provider_rate_limited', comparison: null };
    }

    try {
      const result = await withTimeout(
        this.provider.interpret(input),
        this.config.providerTimeoutMs(),
      );
      const usage = normalizeUsage(result);

      return {
        status: 'completed',
        comparison: this.shadow.compare(deterministic, result.candidate),
        usage,
      };
    } catch (error) {
      if (error instanceof ShadowProviderTimeoutError) {
        return { status: 'provider_timeout', comparison: null };
      }
      return { status: 'provider_error', comparison: null };
    }
  }

  private reserveProviderCall(now: number): boolean {
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    while (
      this.providerCallTimes.length > 0 &&
      this.providerCallTimes[0] <= cutoff
    ) {
      this.providerCallTimes.shift();
    }

    if (
      this.providerCallTimes.length >= this.config.maxProviderCallsPerMinute()
    ) {
      return false;
    }

    this.providerCallTimes.push(now);
    return true;
  }
}

class ShadowProviderTimeoutError extends Error {
  constructor() {
    super('shadow_provider_timeout');
  }
}

function normalizeUsage(
  result: AiArmanInterpretationProviderResult,
): ChatInterpretationShadowUsage {
  const usage = result.usage;
  assertNonNegativeInteger(usage.inputTokens);
  assertNonNegativeInteger(usage.outputTokens);

  if (
    usage.estimatedCostUsd !== undefined &&
    (!Number.isFinite(usage.estimatedCostUsd) || usage.estimatedCostUsd < 0)
  ) {
    throw new Error('shadow_provider_usage_invalid');
  }

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.inputTokens + usage.outputTokens,
    estimatedCostUsd: usage.estimatedCostUsd ?? null,
  };
}

function assertNonNegativeInteger(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('shadow_provider_usage_invalid');
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
