import { Injectable } from '@nestjs/common';
import { readAiArmanModelInterpretationConfig } from '../model/model-interpretation.config';

export const AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED_ENV =
  'AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED';

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
      timeoutMs: Math.min(8000, Math.max(1000, model.timeoutMs)),
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
