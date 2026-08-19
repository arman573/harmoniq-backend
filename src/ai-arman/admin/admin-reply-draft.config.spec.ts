import { AiArmanAdminReplyDraftConfig } from './admin-reply-draft.config';

describe('AiArmanAdminReplyDraftConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses a dedicated 12 second default for reply generation', () => {
    enableModel();
    delete process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS;
    expect(new AiArmanAdminReplyDraftConfig().read().timeoutMs).toBe(12_000);
  });

  it('accepts 15 seconds for admin reply generation without changing model interpretation timeout', () => {
    enableModel();
    process.env.AI_ARMAN_MODEL_INTERPRETATION_TIMEOUT_MS = '10000';
    process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS = '15000';
    const config = new AiArmanAdminReplyDraftConfig().read();
    expect(config.timeoutMs).toBe(15_000);
    expect(config.activationAllowed).toBe(true);
  });

  it('keeps the dedicated reply timeout bounded', () => {
    enableModel();
    process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS = '99999';
    expect(new AiArmanAdminReplyDraftConfig().read().timeoutMs).toBe(20_000);
    process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_TIMEOUT_MS = '100';
    expect(new AiArmanAdminReplyDraftConfig().read().timeoutMs).toBe(3_000);
  });
});

function enableModel() {
  process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_ENABLED = 'true';
  process.env.AI_ARMAN_MODEL_INTERPRETATION_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_ARMAN_OPENAI_MODEL = 'gpt-test';
  process.env.AI_ARMAN_MODEL_INPUT_COST_USD_PER_MILLION_TOKENS = '1';
  process.env.AI_ARMAN_MODEL_OUTPUT_COST_USD_PER_MILLION_TOKENS = '1';
}
