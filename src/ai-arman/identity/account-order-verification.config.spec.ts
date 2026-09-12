import { readAccountOrderVerificationConfig } from './account-order-verification.config';

describe('readAccountOrderVerificationConfig', () => {
  it('is disabled by default', () => {
    const config = readAccountOrderVerificationConfig({});

    expect(config.activationAllowed).toBe(false);
    expect(config.reason).toBe('default_disabled');
  });

  it('does not activate from Vendre credentials alone', () => {
    const config = readAccountOrderVerificationConfig({
      VENDRE_API_BASE_URL: 'https://www.harmoniq.se',
      VENDRE_API_KEY: 'test-key',
    });

    expect(config.activationAllowed).toBe(false);
    expect(config.reason).toBe('default_disabled');
  });

  it('requires Vendre configuration after explicit opt-in', () => {
    const config = readAccountOrderVerificationConfig({
      AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED: 'true',
    });

    expect(config.activationAllowed).toBe(false);
    expect(config.reason).toBe('vendre_configuration_required');
  });

  it('rejects insecure Vendre base URLs', () => {
    const config = readAccountOrderVerificationConfig({
      AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED: 'true',
      VENDRE_API_BASE_URL: 'http://www.harmoniq.se',
      VENDRE_API_KEY: 'test-key',
    });

    expect(config.activationAllowed).toBe(false);
    expect(config.reason).toBe('vendre_configuration_required');
  });

  it('allows activation only with explicit opt-in and HTTPS Vendre credentials', () => {
    const config = readAccountOrderVerificationConfig({
      AI_ARMAN_VENDRE_ACCOUNT_ORDER_VERIFICATION_ENABLED: 'true',
      VENDRE_API_BASE_URL: 'https://www.harmoniq.se',
      VENDRE_API_KEY: 'test-key',
    });

    expect(config).toMatchObject({
      enabled: true,
      baseUrl: 'https://www.harmoniq.se',
      apiKey: 'test-key',
      activationAllowed: true,
      reason: 'vendre_activation_allowed',
    });
  });
});
