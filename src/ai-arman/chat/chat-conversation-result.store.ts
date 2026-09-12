import { Injectable } from '@nestjs/common';
import { reviewSkincareRoutineSafety } from '../skincare/skincare-routine-safety-review.service';
import {
  ChatConversationResultRepository,
  type StoredChatResult,
} from './chat-conversation.repositories';
import type { AiArmanChatResponse } from './chat-messages.types';

const RESULT_TTL_MS = 30 * 60 * 1000;
const MAX_RESULTS = 2000;

type StoredResultEntry = {
  result: StoredChatResult;
  expiresAt: number;
};

@Injectable()
export class ChatConversationResultStore extends ChatConversationResultRepository {
  private readonly results = new Map<string, StoredResultEntry>();

  get(key: string): StoredChatResult | null {
    const now = Date.now();
    this.pruneExpired(now);

    const entry = this.results.get(key);
    if (!entry) return null;

    this.results.delete(key);
    this.results.set(key, entry);

    return {
      fingerprint: entry.result.fingerprint,
      response: cloneResponse(entry.result.response),
    };
  }

  save(
    key: string,
    fingerprint: string,
    response: AiArmanChatResponse,
  ): AiArmanChatResponse {
    const now = Date.now();
    this.pruneExpired(now);

    const snapshot = cloneResponse(withSkincareRoutineReview(response));
    this.results.delete(key);
    this.results.set(key, {
      result: { fingerprint, response: snapshot },
      expiresAt: now + RESULT_TTL_MS,
    });
    this.enforceMaxSize();

    return cloneResponse(snapshot);
  }

  private pruneExpired(now: number) {
    for (const [key, entry] of this.results) {
      if (entry.expiresAt <= now) {
        this.results.delete(key);
      }
    }
  }

  private enforceMaxSize() {
    while (this.results.size > MAX_RESULTS) {
      const oldestKey = this.results.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.results.delete(oldestKey);
    }
  }
}

function withSkincareRoutineReview(
  response: AiArmanChatResponse,
): AiArmanChatResponse {
  if (response.interpretation.entities.recommendationDomain !== 'skincare') {
    return response;
  }

  return {
    ...response,
    safety: {
      ...response.safety,
      skincareRoutineReview: reviewSkincareRoutineSafety({
        needs: response.interpretation.entities.needs,
        actives: response.interpretation.entities.skincareRoutineActives ?? [],
      }),
    },
  };
}

function cloneResponse(response: AiArmanChatResponse): AiArmanChatResponse {
  return JSON.parse(JSON.stringify(response)) as AiArmanChatResponse;
}
