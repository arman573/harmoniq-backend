import type { AiArmanConversationState } from './chat-messages.types';

export type AiArmanInterpretationProviderInput = {
  text: string;
  locale: 'sv-SE';
  previousState: AiArmanConversationState | null;
};

export type AiArmanInterpretationProviderMetadata = {
  provider: string;
  modelVersion: string;
  promptVersion: string;
};

export type AiArmanInterpretationProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
};

export type AiArmanInterpretationProviderResult = {
  candidate: unknown;
  usage: AiArmanInterpretationProviderUsage;
};

export type AiArmanInterpretationProviderErrorCode =
  | 'authentication'
  | 'quota'
  | 'unavailable'
  | 'invalid_response';

export class ChatInterpretationProviderError extends Error {
  constructor(readonly code: AiArmanInterpretationProviderErrorCode) {
    super(`chat_interpretation_provider_error:${code}`);
    this.name = 'ChatInterpretationProviderError';
  }
}

export abstract class ChatInterpretationProvider {
  abstract metadata(): AiArmanInterpretationProviderMetadata;

  abstract interpret(
    input: AiArmanInterpretationProviderInput,
  ): Promise<AiArmanInterpretationProviderResult>;
}
