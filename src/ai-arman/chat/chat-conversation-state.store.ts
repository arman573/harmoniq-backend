import { Injectable } from '@nestjs/common';
import { ChatConversationStateRepository } from './chat-conversation.repositories';
import type { AiArmanConversationState } from './chat-messages.types';

@Injectable()
export class ChatConversationStateStore extends ChatConversationStateRepository {
  private readonly states = new Map<string, AiArmanConversationState>();

  get(conversationId: string): AiArmanConversationState | null {
    const state = this.states.get(conversationId);
    return state ? cloneState(state) : null;
  }

  save(state: AiArmanConversationState): AiArmanConversationState {
    const snapshot = cloneState(state);
    this.states.set(state.conversationId, snapshot);
    return cloneState(snapshot);
  }
}

function cloneState(state: AiArmanConversationState): AiArmanConversationState {
  return {
    ...state,
    remembered: {
      ...state.remembered,
      requestedProductTypes: [...state.remembered.requestedProductTypes],
      needs: [...state.remembered.needs],
      exclusions: [...state.remembered.exclusions],
      productReferences: [...state.remembered.productReferences],
    },
    pendingQuestion: state.pendingQuestion ? { ...state.pendingQuestion } : null,
  };
}
