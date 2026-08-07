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

export abstract class ChatInterpretationProvider {
  abstract metadata(): AiArmanInterpretationProviderMetadata;

  abstract interpret(
    input: AiArmanInterpretationProviderInput,
  ): Promise<AiArmanInterpretationProviderResult>;
}
