import type { AiArmanConversationState } from './chat-messages.types';

export type AiArmanInterpretationProviderInput = {
  text: string;
  locale: 'sv-SE';
  previousState: AiArmanConversationState | null;
};

export abstract class ChatInterpretationProvider {
  abstract interpret(
    input: AiArmanInterpretationProviderInput,
  ): Promise<unknown>;
}
