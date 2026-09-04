import { Injectable } from '@nestjs/common';
import { ChatConversationStateRepository } from './chat-conversation.repositories';
import type { AiArmanConversationState } from './chat-messages.types';

const STATE_TTL_MS = 30 * 60 * 1000;
const MAX_STATES = 1000;

type StoredState = {
  state: AiArmanConversationState;
  expiresAt: number;
};

@Injectable()
export class ChatConversationStateStore extends ChatConversationStateRepository {
  private readonly states = new Map<string, StoredState>();

  get(conversationId: string): AiArmanConversationState | null {
    const now = Date.now();
    this.pruneExpired(now);

    const entry = this.states.get(conversationId);
    if (!entry) return null;

    this.states.delete(conversationId);
    this.states.set(conversationId, entry);
    return cloneState(entry.state);
  }

  save(state: AiArmanConversationState): AiArmanConversationState {
    const now = Date.now();
    this.pruneExpired(now);

    const snapshot = cloneState(state);
    this.states.delete(state.conversationId);
    this.states.set(state.conversationId, {
      state: snapshot,
      expiresAt: now + STATE_TTL_MS,
    });
    this.enforceMaxSize();

    return cloneState(snapshot);
  }

  private pruneExpired(now: number) {
    for (const [key, entry] of this.states) {
      if (entry.expiresAt <= now) {
        this.states.delete(key);
      }
    }
  }

  private enforceMaxSize() {
    while (this.states.size > MAX_STATES) {
      const oldestKey = this.states.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.states.delete(oldestKey);
    }
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
