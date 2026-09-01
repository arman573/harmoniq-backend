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
  'admin_reply_model_incomplete',
]);

const SAFE_FAILURE_CODES = new Set([
  'invalid_admin_reply_context',
  'admin_reply_model_http_error',
  'admin_reply_model_timeout',
  'admin_reply_model_request_failed',
  'admin_reply_model_incomplete',
  'admin_reply_model_missing_output',
  'admin_reply_model_invalid',
]);

const RETRY_DELAY_MS = 180;

@Injectable()
export class AiArmanAdminReplyDraftRetryingService extends AiArmanAdminReplyDraftService {
  constructor(config: AiArmanAdminReplyDraftConfig) {
    super(config);
  }

  override async createDraft(input: AiArmanAdminReplyDraftInput) {
    const firstStartedAt = Date.now();
    const first = await super.createDraft(input);
    if (!first.ok) {
      logFailure(first, 1, Date.now() - firstStartedAt);
    }
    if (first.ok || !RETRYABLE_CODES.has(first.code)) return first;

    await delay(RETRY_DELAY_MS);

    const secondStartedAt = Date.now();
    const second = await super.createDraft(input);
    if (!second.ok) {
      logFailure(second, 2, Date.now() - secondStartedAt);
    }
    return second;
  }
}

function logFailure(
  result: { code?: unknown; providerHttpStatus?: unknown },
  attempt: 1 | 2,
  durationMs: number,
): void {
  const code =
    typeof result.code === 'string' && SAFE_FAILURE_CODES.has(result.code)
      ? result.code
      : 'unknown';
  const providerHttpStatus =
    typeof result.providerHttpStatus === 'number' &&
    Number.isInteger(result.providerHttpStatus) &&
    result.providerHttpStatus >= 100 &&
    result.providerHttpStatus <= 599
      ? result.providerHttpStatus
      : undefined;

  console.warn(
    JSON.stringify({
      event: 'ai_arman_admin_reply_draft_failed',
      code,
      attempt,
      durationMs: Math.max(0, Math.trunc(durationMs)),
      ...(providerHttpStatus === undefined ? {} : { providerHttpStatus }),
    }),
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
