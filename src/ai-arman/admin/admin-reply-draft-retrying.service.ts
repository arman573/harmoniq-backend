import { Injectable } from '@nestjs/common';
import { AiArmanAdminReplyDraftConfig } from './admin-reply-draft.config';
import {
  AiArmanAdminReplyDraftService,
  type AiArmanAdminReplyDraftInput,
} from './admin-reply-draft.service';

const RETRYABLE_CODES = new Set([
  'admin_reply_model_http_error',
  'admin_reply_model_timeout',
  'admin_reply_model_request_failed',
]);

const RETRY_DELAY_MS = 180;

@Injectable()
export class AiArmanAdminReplyDraftRetryingService extends AiArmanAdminReplyDraftService {
  constructor(config: AiArmanAdminReplyDraftConfig) {
    super(config);
  }

  override async createDraft(input: AiArmanAdminReplyDraftInput) {
    const first = await super.createDraft(input);
    if (first.ok || !RETRYABLE_CODES.has(first.code)) return first;

    await delay(RETRY_DELAY_MS);
    return super.createDraft(input);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
