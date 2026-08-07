import { Injectable, Optional } from '@nestjs/common';
import {
  ChatInterpretationProvider,
  type AiArmanInterpretationProviderInput,
  type AiArmanInterpretationProviderMetadata,
  type AiArmanInterpretationProviderResult,
} from './chat-interpretation.provider';
import {
  ChatInterpretationShadowAuditSink,
  type ChatInterpretationShadowAuditRecord,
} from './chat-interpretation-shadow-audit.store';
import {
  ChatInterpretationShadowConfig,
} from './chat-interpretation-shadow.config';
import {
  ChatInterpretationShadowService,
  type ChatInterpretationShadowComparison,
} from './chat-interpretation-shadow.service';
import type { AiArmanInterpretation } from './chat-messages.types';

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_METADATA_LENGTH = 120;

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
    @Optional()
    private readonly auditSink?: ChatInterpretationShadowAuditSink,
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

    let metadata: AiArmanInterpretationProviderMetadata;
    try {
      metadata = normalizeMetadata(this.provider.metadata());
    } catch {
      return { status: 'provider_error', comparison: null };
    }

    if (!this.reserveProviderCall(Date.now())) {
      this.recordAudit(metadata, {
        status: 'provider_rate_limited',
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        candidateValid: null,
        primaryIntentMatch: null,
      });
      return { status: 'provider_rate_limited', comparison: null };
    }

    const startedAt = Date.now();

    try {
      const result = await withTimeout(
        this.provider.interpret(input),
        this.config.providerTimeoutMs(),
      );
      const usage = normalizeUsage(result);
      const comparison = this.shadow.compare(deterministic, result.candidate);

      this.recordAudit(metadata, {
        status: 'completed',
        latencyMs: Math.max(0, Date.now() - startedAt),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: usage.estimatedCostUsd,
        candidateValid: comparison.status === 'valid_candidate',
        primaryIntentMatch: comparison.primaryIntentMatch,
      });

      return {
        status: 'completed',
        comparison,
        usage,
      };
    } catch (error) {
      const latencyMs = Math.max(0, Date.now() - startedAt);

      if (error instanceof ShadowProviderTimeoutError) {
        this.recordAudit(metadata, {
          status: 'provider_timeout',
          latencyMs,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          candidateValid: null,
          primaryIntentMatch: null,
        });
        return { status: 'provider_timeout', comparison: null };
      }

      this.recordAudit(metadata, {
        status: 'provider_error',
        latencyMs,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        candidateValid: null,
        primaryIntentMatch: null,
      });
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

  private recordAudit(
    metadata: AiArmanInterpretationProviderMetadata,
    record: Omit<
      ChatInterpretationShadowAuditRecord,
      'recordedAt' | 'provider' | 'modelVersion' | 'promptVersion'
    >,
  ): void {
    if (!this.auditSink) return;

    try {
      this.auditSink.record({
        recordedAt: new Date().toISOString(),
        provider: metadata.provider,
        modelVersion: metadata.modelVersion,
        promptVersion: metadata.promptVersion,
        ...record,
      });
    } catch {
      // Audit must never affect the customer-facing deterministic path.
    }
  }
}

class ShadowProviderTimeoutError extends Error {
  constructor() {
    super('shadow_provider_timeout');
  }
}

function normalizeMetadata(
  metadata: AiArmanInterpretationProviderMetadata,
): AiArmanInterpretationProviderMetadata {
  return {
    provider: normalizeMetadataValue(metadata.provider),
    modelVersion: normalizeMetadataValue(metadata.modelVersion),
    promptVersion: normalizeMetadataValue(metadata.promptVersion),
  };
}

function normalizeMetadataValue(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('shadow_provider_metadata_invalid');
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_METADATA_LENGTH) {
    throw new Error('shadow_provider_metadata_invalid');
  }
  return normalized;
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
