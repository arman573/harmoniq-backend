import { Injectable } from '@nestjs/common';
import type { AiArmanChatResponse } from './chat-messages.types';

type StoredChatResult = {
  fingerprint: string;
  response: AiArmanChatResponse;
};

@Injectable()
export class ChatConversationResultStore {
  private readonly results = new Map<string, StoredChatResult>();

  get(key: string): StoredChatResult | null {
    const result = this.results.get(key);
    if (!result) return null;

    return {
      fingerprint: result.fingerprint,
      response: cloneResponse(result.response),
    };
  }

  save(
    key: string,
    fingerprint: string,
    response: AiArmanChatResponse,
  ): AiArmanChatResponse {
    const snapshot = cloneResponse(response);
    this.results.set(key, { fingerprint, response: snapshot });
    return cloneResponse(snapshot);
  }
}

function cloneResponse(response: AiArmanChatResponse): AiArmanChatResponse {
  return JSON.parse(JSON.stringify(response)) as AiArmanChatResponse;
}
