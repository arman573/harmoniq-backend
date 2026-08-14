export type AiArmanModelInterpretationConfig = {
  enabled: boolean;
  activationAllowed: boolean;
  apiKey: string;
  model: string;
  timeoutMs: number;
  reason:
    | 'model_interpretation_allowed'
    | 'default_disabled'
    | 'api_key_missing'
    | 'model_missing_or_invalid';
};

const DEFAULT_TIMEOUT_MS = 3000;

export function readAiArmanModelInterpretationConfig(): AiArmanModelInterpretationConfig {
  const enabled =
    String(process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED || '') === 'true';
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.AI_ARMAN_OPENAI_MODEL || '').trim();
  const timeoutMs = readTimeout();

  if (!enabled) {
    return {
      enabled: false,
      activationAllowed: false,
      apiKey,
      model,
      timeoutMs,
      reason: 'default_disabled',
    };
  }

  if (!apiKey) {
    return {
      enabled: true,
      activationAllowed: false,
      apiKey: '',
      model,
      timeoutMs,
      reason: 'api_key_missing',
    };
  }

  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(model)) {
    return {
      enabled: true,
      activationAllowed: false,
      apiKey,
      model: '',
      timeoutMs,
      reason: 'model_missing_or_invalid',
    };
  }

  return {
    enabled: true,
    activationAllowed: true,
    apiKey,
    model,
    timeoutMs,
    reason: 'model_interpretation_allowed',
  };
}

function readTimeout(): number {
  const configured = Number(process.env.AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(10_000, Math.max(500, Math.trunc(configured)));
}
