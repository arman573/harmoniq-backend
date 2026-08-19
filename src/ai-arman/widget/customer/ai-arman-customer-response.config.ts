import { Injectable } from '@nestjs/common';
import { readAiArmanModelInterpretationConfig } from '../../model/model-interpretation.config';

export const AI_ARMAN_CUSTOMER_RESPONSE_ENABLED_ENV =
  'AI_ARMAN_CUSTOMER_RESPONSE_ENABLED';

@Injectable()
export class AiArmanCustomerResponseConfig {
  read() {
    const model = readAiArmanModelInterpretationConfig();
    const enabled = String(process.env[AI_ARMAN_CUSTOMER_RESPONSE_ENABLED_ENV] || '') === 'true';
    return {
      enabled,
      activationAllowed: enabled && model.activationAllowed,
      apiKey: model.apiKey,
      model: model.model,
      timeoutMs: Math.min(8000, Math.max(1000, model.timeoutMs)),
    };
  }
}
