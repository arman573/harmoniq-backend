import { readAiArmanModelInterpretationConfig } from './model-interpretation.config';

const ENV_KEYS = [
  'AI_ARMAN_MODEL_INTERPRETATION_ENABLED',
  'OPENAI_API_KEY',
  'AI_ARMAN_OPENAI_MODEL',
  'AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS',
  'AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS',
  'AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS',
] as const;

describe('readAiArmanModelInterpretationConfig', () => {
  const original = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = original.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('remains disabled by default', () => {
    expect(readAiArmanModelInterpretationConfig()).toMatchObject({
      enabled: false,
      activationAllowed: false,
      inputCostUsdPerMillionTokens: 0,
      outputCostUsdPerMillionTokens: 0,
      reason: 'default_disabled',
    });
  });

  it('fails closed when pricing is missing even with key and model configured', () => {
    process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'configured';
    process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-5-mini';

    expect(readAiArmanModelInterpretationConfig()).toMatchObject({
      enabled: true,
      activationAllowed: false,
      reason: 'pricing_missing_or_invalid',
    });
  });

  it('allows activation only with positive explicit input and output pricing', () => {
    process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'configured';
    process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-5-mini';
    process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '0.25';
    process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '2';

    expect(readAiArmanModelInterpretationConfig()).toMatchObject({
      enabled: true,
      activationAllowed: true,
      model: 'gpt-5-mini',
      inputCostUsdPerMillionTokens: 0.25,
      outputCostUsdPerMillionTokens: 2,
      reason: 'model_interpretation_allowed',
    });
  });

  it.each(['0', '-1', 'not-a-number'])('rejects invalid pricing value %s', (value) => {
    process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'configured';
    process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-5-mini';
    process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = value;
    process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '2';

    expect(readAiArmanModelInterpretationConfig()).toMatchObject({
      activationAllowed: false,
      reason: 'pricing_missing_or_invalid',
    });
  });
});
