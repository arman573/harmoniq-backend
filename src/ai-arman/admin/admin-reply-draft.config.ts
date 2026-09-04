import { Injectable } from '@nestjs/common';
import { readAiArmanModelInterpretationConfig } from '../model/model-interpretation.config';

export const AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED_ENV =
  'AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED';
export const AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS_ENV =
  'AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS';

const DEFAULT_ADMIN_REPLY_TIMEOUT_MS = 18_000;
const MIN_ADMIN_REPLY_TIMEOUT_MS = 3_000;
const MAX_ADMIN_REPLY_TIMEOUT_MS = 20_000;

@Injectable()
export class AiArmanAdminReplyDraftConfig {
  read() {
    const model = readAiArmanModelInterpretationConfig();
    const enabled =
      String(process.env[AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED_ENV] || '') === 'true';

    return {
      enabled,
      activationAllowed: enabled && model.activationAllowed,
      apiKey: model.apiKey,
      model: model.model,
      timeoutMs: readAdminReplyTimeout(),
      inputCostUsdPerMillionTokens: model.inputCostUsdPerMillionTokens,
      outputCostUsdPerMillionTokens: model.outputCostUsdPerMillionTokens,
      reason: !enabled
        ? 'admin_reply_draft_disabled'
        : model.activationAllowed
          ? 'admin_reply_draft_allowed'
          : model.reason,
    } as const;
  }
}

function readAdminReplyTimeout(): number {
  const configured = Number(process.env[AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS_ENV]);
  if (!Number.isFinite(configured)) return DEFAULT_ADMIN_REPLY_TIMEOUT_MS;
  return Math.min(
    MAX_ADMIN_REPLY_TIMEOUT_MS,
    Math.max(MIN_ADMIN_REPLY_TIMEOUT_MS, Math.trunc(configured)),
  );
}
