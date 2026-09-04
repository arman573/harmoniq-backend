import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AiArmanAdminCaseResolverController } from './admin-case-resolver.controller';

describe('AiArmanAdminCaseResolverController', () => {
  const originalResolverToken = process.env.AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN;
  const originalReplyToken = process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN;

  afterEach(() => {
    restoreEnv('AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN', originalResolverToken);
    restoreEnv('AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN', originalReplyToken);
  });

  it('stays hidden when the resolver feature is disabled', async () => {
    const config = { read: () => ({ activationAllowed: false }) } as any;
    const resolver = { prepare: jest.fn(), execute: jest.fn() } as any;
    const controller = new AiArmanAdminCaseResolverController(config, resolver);

    expect(() => controller.prepare({ caseId: 'HQR-12345' }, requestWithToken('token')))
      .toThrow(NotFoundException);
    expect(resolver.prepare).not.toHaveBeenCalled();
  });

  it('requires a matching internal token when enabled', () => {
    process.env.AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN = 'resolver-secret';
    const config = { read: () => ({ activationAllowed: true }) } as any;
    const resolver = { prepare: jest.fn(), execute: jest.fn() } as any;
    const controller = new AiArmanAdminCaseResolverController(config, resolver);

    expect(() => controller.prepare({ caseId: 'HQR-12345' }, requestWithToken('wrong')))
      .toThrow(UnauthorizedException);
    expect(resolver.prepare).not.toHaveBeenCalled();
  });

  it('accepts the resolver-specific token', async () => {
    process.env.AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN = 'resolver-secret';
    const config = { read: () => ({ activationAllowed: true }) } as any;
    const resolver = {
      prepare: jest.fn().mockResolvedValue({ ok: true }),
      execute: jest.fn(),
    } as any;
    const controller = new AiArmanAdminCaseResolverController(config, resolver);

    await expect(
      controller.prepare({ caseId: 'HQR-12345' }, requestWithToken('resolver-secret')),
    ).resolves.toEqual({ ok: true });
  });

  it('falls back to the existing reply-draft internal token', async () => {
    delete process.env.AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN;
    process.env.AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN = 'shared-admin-secret';
    const config = { read: () => ({ activationAllowed: true }) } as any;
    const resolver = {
      prepare: jest.fn(),
      execute: jest.fn().mockResolvedValue({ ok: true, writeExecuted: false }),
    } as any;
    const controller = new AiArmanAdminCaseResolverController(config, resolver);

    await expect(
      controller.execute(
        { caseId: 'HQR-12345', approved: false, action: 'case.complete' },
        requestWithToken('shared-admin-secret'),
      ),
    ).resolves.toEqual({ ok: true, writeExecuted: false });
  });
});

function requestWithToken(token: string) {
  return {
    headers: { 'x-ai-arman-admin-token': token },
  } as any;
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
