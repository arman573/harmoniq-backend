import { Test } from '@nestjs/testing';
import { AiArmanModule } from './ai-arman.module';
import {
  DisabledProductLiveFactsClient,
  ProductLiveFactsClient,
} from './integrations/product-live-facts.client';
import { VendreProductLiveFactsClient } from './integrations/vendre-product-live-facts.client';

const LIVE_FACTS_ENV_KEYS = [
  'AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER',
  'AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED',
  'VENDRE_API_BASE_URL',
  'VENDRE_API_KEY',
] as const;

type LiveFactsEnvKey = (typeof LIVE_FACTS_ENV_KEYS)[number];

const originalEnv = Object.fromEntries(
  LIVE_FACTS_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<LiveFactsEnvKey, string | undefined>;

function clearLiveFactsEnv() {
  for (const key of LIVE_FACTS_ENV_KEYS) delete process.env[key];
}

function restoreLiveFactsEnv() {
  clearLiveFactsEnv();
  for (const key of LIVE_FACTS_ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

async function compileAiArmanModule() {
  return Test.createTestingModule({ imports: [AiArmanModule] }).compile();
}

describe('AiArmanModule live facts provider wiring', () => {
  beforeEach(() => {
    clearLiveFactsEnv();
  });

  afterEach(() => {
    restoreLiveFactsEnv();
    jest.restoreAllMocks();
  });

  it('boots with the disabled provider by default without making a network call', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(ProductLiveFactsClient);
    const disabled = moduleRef.get(DisabledProductLiveFactsClient);

    expect(selected).toBe(disabled);
    expect(selected).toBeInstanceOf(DisabledProductLiveFactsClient);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('keeps the disabled provider when Vendre credentials exist without AI Arman opt-in', async () => {
    process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(ProductLiveFactsClient);
    const disabled = moduleRef.get(DisabledProductLiveFactsClient);

    expect(selected).toBe(disabled);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('selects Vendre only with the full explicit gate and still makes no bootstrap network call', async () => {
    process.env.AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER = 'vendre';
    process.env.AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED = 'true';
    process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(ProductLiveFactsClient);
    const vendre = moduleRef.get(VendreProductLiveFactsClient);

    expect(selected).toBe(vendre);
    expect(selected).toBeInstanceOf(VendreProductLiveFactsClient);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });
});
