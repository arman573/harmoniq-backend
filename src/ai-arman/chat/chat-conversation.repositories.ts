import type {
  AiArmanChatResponse,
  AiArmanConversationState,
} from './chat-messages.types';

export type StoredChatResult = {
  fingerprint: string;
  response: AiArmanChatResponse;
};

export abstract class ChatConversationStateRepository {
  abstract get(conversationId: string): AiArmanConversationState | null;
  abstract save(state: AiArmanConversationState): AiArmanConversationState;
}

export abstract class ChatConversationResultRepository {
  abstract get(key: string): StoredChatResult | null;
  abstract save(
    key: string,
    fingerprint: string,
    response: AiArmanChatResponse,
  ): AiArmanChatResponse;
}
