import { Injectable } from '@nestjs/common';
import {
  ChatInterpretationProvider,
  ChatInterpretationProviderError,
  type AiArmanInterpretationProviderInput,
  type AiArmanInterpretationProviderMetadata,
  type AiArmanInterpretationProviderResult,
} from '../chat/chat-interpretation.provider';
import { readAiArmanModelInterpretationConfig } from './model-interpretation.config';
import { AiArmanModelInterpretationClient } from './model-interpretation.client';

const PROMPT_VERSION = 'ai-arman-interpretation-v1';
const TOKENS_PER_MILLION = 1_000_000;

@Injectable()
export class OpenAiChatInterpretationProvider extends ChatInterpretationProvider {
  constructor(private readonly client: AiArmanModelInterpretationClient) {
    super();
  }

  metadata(): AiArmanInterpretationProviderMetadata {
    const config = readAiArmanModelInterpretationConfig();
    return {
      provider: 'openai',
      modelVersion: config.model || 'not-configured',
      promptVersion: PROMPT_VERSION,
    };
  }

  async interpret(
    input: AiArmanInterpretationProviderInput,
  ): Promise<AiArmanInterpretationProviderResult> {
    const config = readAiArmanModelInterpretationConfig();
    if (!config.activationAllowed) {
      throw new ChatInterpretationProviderError('unavailable');
    }

    const result = await this.client.interpret({ text: input.text });

    if (!result.ok) {
      switch (result.error) {
        case 'model_interpretation_authentication':
          throw new ChatInterpretationProviderError('authentication');
        case 'model_interpretation_quota':
          throw new ChatInterpretationProviderError('quota');
        case 'model_interpretation_invalid':
          throw new ChatInterpretationProviderError('invalid_response');
        case 'model_interpretation_disabled':
        case 'model_interpretation_unavailable':
          throw new ChatInterpretationProviderError('unavailable');
      }
    }

    const estimatedCostUsd =
      (result.usage.inputTokens * config.inputCostUsdPerMillionTokens) /
        TOKENS_PER_MILLION +
      (result.usage.outputTokens * config.outputCostUsdPerMillionTokens) /
        TOKENS_PER_MILLION;

    return {
      candidate: result.candidate,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        estimatedCostUsd,
      },
    };
  }
}
