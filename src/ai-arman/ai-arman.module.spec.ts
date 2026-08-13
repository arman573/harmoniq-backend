import { Test } from '@nestjs/testing';
import { AiArmanModule } from './ai-arman.module';
import { AuthenticatedAccountOrderAccessService } from './identity/authenticated-account-order-access.service';
import { ConversationCustomerVerificationStore } from './identity/conversation-customer-verification.store';
import {
  AccountOrderVerificationProvider,
  DisabledAccountOrderVerificationProvider,
} from './identity/customer-identity-verification.providers';
import { VendreAccountOrderVerificationProvider } from './identity/vendre-account-order-verification.provider';
import {
  DisabledProductLiveFactsClient,
  ProductLiveFactsClient,
} from './integrations/product-live-facts.client';
import { VendreProductLiveFactsClient } from './integrations/vendre-product-live-facts.client';
import { VerifiedReturnsReadService } from './integrations/verified-returns-read.service';

const ENV_KEYS = [
  'AI_ARMAN_PRODUCT_LIVE_FACTS_PROVIDER',
  'AI_ARMAN_PRODUCT_LIVE_FACTS_ENABLED',
  'AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED',
  'AI_ARMAN_VENDRE_ACCOUNT_ORDER_TIMEOUT_MS',
  'VENDRE_API_BASE_URL',
  'VENDRE_API_KEY',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<EnvKey, string | undefined>;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function restoreEnv() {
  clearEnv();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

async function compileAiArmanModule() {
  return Test.createTestingModule({ imports: [AiArmanModule] }).compile();
}

describe('AiArmanModule guarded provider wiring', () => {
  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    restoreEnv();
    jest.restoreAllMocks();
  });

  it('boots with disabled live facts by default without making a network call', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(ProductLiveFactsClient);
    const disabled = moduleRef.get(DisabledProductLiveFactsClient);

    expect(selected).toBe(disabled);
    expect(selected).toBeInstanceOf(DisabledProductLiveFactsClient);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('keeps live facts disabled when Vendre credentials exist without AI Arman opt-in', async () => {
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

  it('selects Vendre live facts only with the full explicit gate and makes no bootstrap network call', async () => {
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

  it('boots with disabled account-order verification by default', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(AccountOrderVerificationProvider);
    const disabled = moduleRef.get(DisabledAccountOrderVerificationProvider);

    expect(selected).toBe(disabled);
    expect(selected).toBeInstanceOf(DisabledAccountOrderVerificationProvider);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('does not activate account-order verification from Vendre credentials alone', async () => {
    process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(AccountOrderVerificationProvider);
    const disabled = moduleRef.get(DisabledAccountOrderVerificationProvider);

    expect(selected).toBe(disabled);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('selects Vendre account-order verification only after explicit opt-in and makes no bootstrap request', async () => {
    process.env.AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED = 'true';
    process.env.VENDRE_API_BASE_URL = 'https://www.harmoniq.se';
    process.env.VENDRE_API_KEY = 'test-key';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    const selected = moduleRef.get(AccountOrderVerificationProvider);
    const vendre = moduleRef.get(VendreAccountOrderVerificationProvider);

    expect(selected).toBe(vendre);
    expect(selected).toBeInstanceOf(VendreAccountOrderVerificationProvider);
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  it('wires authenticated account verification and verified returns reads without bootstrap requests', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const moduleRef = await compileAiArmanModule();

    expect(moduleRef.get(ConversationCustomerVerificationStore)).toBeInstanceOf(
      ConversationCustomerVerificationStore,
    );
    expect(moduleRef.get(AuthenticatedAccountOrderAccessService)).toBeInstanceOf(
      AuthenticatedAccountOrderAccessService,
    );
    expect(moduleRef.get(VerifiedReturnsReadService)).toBeInstanceOf(
      VerifiedReturnsReadService,
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    await moduleRef.close();
  });
});
