import {
  AI_ARMAN_MODEL_SHADOW_ENABLED_ENV,
  DisabledChatInterpretationShadowConfig,
  EnvChatInterpretationShadowConfig,
} from './chat-interpretation-shadow.config';

describe('ChatInterpretationShadowConfig', () => {
  it('keeps the disabled config permanently off', () => {
    expect(new DisabledChatInterpretationShadowConfig().isEnabled()).toBe(false);
  });

  it('requires the exact shadow opt-in value true', () => {
    const config = new EnvChatInterpretationShadowConfig();

    expect(config.isEnabled({})).toBe(false);
    expect(config.isEnabled({ [AI_ARMAN_MODEL_SHADOW_ENABLED_ENV]: 'TRUE' })).toBe(false);
    expect(config.isEnabled({ [AI_ARMAN_MODEL_SHADOW_ENABLED_ENV]: '1' })).toBe(false);
    expect(config.isEnabled({ [AI_ARMAN_MODEL_SHADOW_ENABLED_ENV]: 'true' })).toBe(true);
  });

  it('uses conservative defaults without optional tuning', () => {
    const config = new EnvChatInterpretationShadowConfig();
    const env = {};

    expect(config.providerTimeoutMs(env)).toBe(1500);
    expect(config.maxProviderCallsPerMinute(env)).toBe(30);
    expect(config.maxConcurrentProviderCalls(env)).toBe(2);
    expect(config.maxProviderTokensPerCall(env)).toBe(4096);
    expect(config.maxProviderTokensPerMinute(env)).toBe(30_000);
    expect(config.maxEstimatedCostUsdPerCall(env)).toBe(0.02);
    expect(config.maxEstimatedCostUsdPerMinute(env)).toBe(0.1);
  });

  it('clamps optional limits to guarded bounds', () => {
    const config = new EnvChatInterpretationShadowConfig();
    const env = {
      AI_ARMAN_MODEL_SHADOW_PROVIDER_TIMEOUT_MS: '999999',
      AI_ARMAN_MODEL_SHADOW_MAX_CALLS_PER_MINUTE: '0',
      AI_ARMAN_MODEL_SHADOW_MAX_CONCURRENT_CALLS: '99',
      AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_CALL: '10',
      AI_ARMAN_MODEL_SHADOW_MAX_TOKENS_PER_MINUTE: '900000',
      AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_CALL: '5',
      AI_ARMAN_MODEL_SHADOW_MAX_COST_USD_PER_MINUTE: '0',
    };

    expect(config.providerTimeoutMs(env)).toBe(10_000);
    expect(config.maxProviderCallsPerMinute(env)).toBe(1);
    expect(config.maxConcurrentProviderCalls(env)).toBe(20);
    expect(config.maxProviderTokensPerCall(env)).toBe(256);
    expect(config.maxProviderTokensPerMinute(env)).toBe(500_000);
    expect(config.maxEstimatedCostUsdPerCall(env)).toBe(1);
    expect(config.maxEstimatedCostUsdPerMinute(env)).toBe(0.001);
  });
});
