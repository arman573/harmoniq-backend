import {
  AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV,
  AiArmanAdminCaseResolverConfig,
} from './admin-case-resolver.config';

describe('AiArmanAdminCaseResolverConfig', () => {
  const original = process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV];
    } else {
      process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV] = original;
    }
  });

  it('is disabled by default', () => {
    delete process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV];
    expect(new AiArmanAdminCaseResolverConfig().read()).toMatchObject({
      enabled: false,
      activationAllowed: false,
      reason: 'admin_case_resolver_disabled',
    });
  });

  it('only enables on an explicit true value', () => {
    process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV] = 'true';
    expect(new AiArmanAdminCaseResolverConfig().read()).toMatchObject({
      enabled: true,
      activationAllowed: true,
      reason: 'admin_case_resolver_allowed',
    });
  });
});
