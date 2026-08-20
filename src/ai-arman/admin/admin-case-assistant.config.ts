import { Injectable } from '@nestjs/common';
import { readAiArmanModelInterpretationConfig } from '../model/model-interpretation.config';

export const AI_ARMAN_ADMIN_ASSISTANT_ENABLED_ENV =
  'AI_ARMAN_ADMIN_ASSISTANT_ENABLED';
export const AI_ARMAN_ADMIN_LEARNING_ENABLED_ENV =
  'AI_ARMAN_ADMIN_LEARNING_ENABLED';

@Injectable()
export class AiArmanAdminCaseAssistantConfig {
  read() {
    const model = readAiArmanModelInterpretationConfig();
    const assistantEnabled =
      String(process.env[AI_ARMAN_ADMIN_ASSISTANT_ENABLED_ENV] || '') === 'true';
    const learningEnabled =
      String(process.env[AI_ARMAN_ADMIN_LEARNING_ENABLED_ENV] || '') === 'true';
    const configuredTimeout = Number(process.env.AI_ARMAN_ADMIN_ASSISTANT_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.min(20_000, Math.max(3_000, Math.trunc(configuredTimeout)))
      : 15_000;

    return {
      assistantEnabled,
      learningEnabled,
      activationAllowed: assistantEnabled && model.activationAllowed,
      apiKey: model.apiKey,
      model: model.model,
      timeoutMs,
      reason: !assistantEnabled
        ? 'admin_assistant_disabled'
        : model.activationAllowed
          ? 'admin_assistant_allowed'
          : model.reason,
    } as const;
  }
}
