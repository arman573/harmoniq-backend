export type AiArmanModelInterpretationConfig = {
  enabled: boolean;
  activationAllowed: boolean;
  apiKey: string;
  model: string;
  timeoutMs: number;
  inputCostUsdPerMillionTokens: number;
  outputCostUsdPerMillionTokens: number;
  reason:
    | 'model_interpretation_allowed'
    | 'default_disabled'
    | 'api_key_missing'
    | 'model_missing_or_invalid'
    | 'pricing_missing_or_invalid';
};

const DEFAULT_TIMEOUT_MS = 3000;

export function readAiArmanModelInterpretationConfig(): AiArmanModelInterpretationConfig {
  const enabled =
    String(process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED || '') === 'true';
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.AI_ARMAN_OPENAI_MODEL || '').trim();
  const timeoutMs = readTimeout();
  const inputCostUsdPerMillionTokens = readPositiveCost(
    process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS,
  );
  const outputCostUsdPerMillionTokens = readPositiveCost(
    process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS,
  );

  const base = {
    timeoutMs,
    inputCostUsdPerMillionTokens,
    outputCostUsdPerMillionTokens,
  };

  if (!enabled) {
    return {
      enabled: false,
      activationAllowed: false,
      apiKey,
      model,
      ...base,
      reason: 'default_disabled',
    };
  }

  if (!apiKey) {
    return {
      enabled: true,
      activationAllowed: false,
      apiKey: '',
      model,
      ...base,
      reason: 'api_key_missing',
    };
  }

  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(model)) {
    return {
      enabled: true,
      activationAllowed: false,
      apiKey,
      model: '',
      ...base,
      reason: 'model_missing_or_invalid',
    };
  }

  if (
    inputCostUsdPerMillionTokens <= 0 ||
    outputCostUsdPerMillionTokens <= 0
  ) {
    return {
      enabled: true,
      activationAllowed: false,
      apiKey,
      model,
      ...base,
      reason: 'pricing_missing_or_invalid',
    };
  }

  return {
    enabled: true,
    activationAllowed: true,
    apiKey,
    model,
    ...base,
    reason: 'model_interpretation_allowed',
  };
}

function readTimeout(): number {
  const configured = Number(process.env.AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(10_000, Math.max(500, Math.trunc(configured)));
}

function readPositiveCost(raw: string | undefined): number {
  if (!raw || !raw.trim()) return 0;
  const configured = Number(raw);
  if (!Number.isFinite(configured) || configured <= 0) return 0;
  return Math.min(10_000, configured);
}
