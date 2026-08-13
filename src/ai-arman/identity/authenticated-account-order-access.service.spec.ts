import type { User } from '../../users/user.entity';
import { AuthenticatedAccountOrderAccessService } from './authenticated-account-order-access.service';
import { ConversationCustomerVerificationStore } from './conversation-customer-verification.store';
import type { CustomerIdentityVerificationService } from './customer-identity-verification.service';

const NOW = new Date('2026-08-13T10:00:00.000Z');

function user(overrides?: Partial<User>): User {
  return {
    id: 42,
    name: 'Customer',
    email: 'current@example.com',
    role: 'user' as User['role'],
    ...overrides,
  };
}

describe('AuthenticatedAccountOrderAccessService', () => {
  it('uses only the trusted authenticated user email and binds the opaque verification id', async () => {
    const verifyAccountOrder = jest.fn().mockResolvedValue({
      ok: true,
      context: {
        verificationId: 'vcv_123e4567-e89b-12d3-a456-426614174000',
        verificationMethod: 'account_assertion',
        subjectHash: 'a'.repeat(64),
        verifiedOrderIds: ['90250'],
        verifiedAt: NOW.toISOString(),
        expiresAt: '2026-08-13T10:15:00.000Z',
      },
    });
    const identityVerification = {
      verifyAccountOrder,
    } as unknown as CustomerIdentityVerificationService;
    const bindings = new ConversationCustomerVerificationStore();
    const service = new AuthenticatedAccountOrderAccessService(
      identityVerification,
      bindings,
    );

    await expect(
      service.verifyAndBind({
        user: user(),
        conversationId: 'conversation_123',
        orderId: '90250',
        now: NOW,
      }),
    ).resolves.toEqual({
      ok: true,
      conversationId: 'conversation_123',
      orderId: '90250',
      expiresAt: '2026-08-13T10:15:00.000Z',
    });

    expect(verifyAccountOrder).toHaveBeenCalledWith(
      {
        authenticatedSubject: 'current@example.com',
        orderId: '90250',
      },
      NOW,
    );
    expect(bindings.resolve('conversation_123', 42, '90250', NOW)).toMatchObject({
      ok: true,
      binding: {
        verificationId: 'vcv_123e4567-e89b-12d3-a456-426614174000',
      },
    });
  });

  it('rejects malformed conversation or order before verification', async () => {
    const verifyAccountOrder = jest.fn();
    const service = new AuthenticatedAccountOrderAccessService(
      { verifyAccountOrder } as unknown as CustomerIdentityVerificationService,
      new ConversationCustomerVerificationStore(),
    );

    await expect(
      service.verifyAndBind({
        user: user(),
        conversationId: 'bad',
        orderId: 'not-an-order',
      }),
    ).resolves.toEqual({ ok: false, error: 'request_invalid' });
    expect(verifyAccountOrder).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated user identity is incomplete', async () => {
    const verifyAccountOrder = jest.fn();
    const service = new AuthenticatedAccountOrderAccessService(
      { verifyAccountOrder } as unknown as CustomerIdentityVerificationService,
      new ConversationCustomerVerificationStore(),
    );

    await expect(
      service.verifyAndBind({
        user: user({ email: '' }),
        conversationId: 'conversation_123',
        orderId: '90250',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'authenticated_identity_invalid',
    });
    expect(verifyAccountOrder).not.toHaveBeenCalled();
  });

  it('does not create a binding when ownership verification fails', async () => {
    const identityVerification = {
      verifyAccountOrder: jest.fn().mockResolvedValue({
        ok: false,
        error: 'verification_rejected',
      }),
    } as unknown as CustomerIdentityVerificationService;
    const bindings = new ConversationCustomerVerificationStore();
    const service = new AuthenticatedAccountOrderAccessService(
      identityVerification,
      bindings,
    );

    await expect(
      service.verifyAndBind({
        user: user(),
        conversationId: 'conversation_123',
        orderId: '90250',
      }),
    ).resolves.toEqual({ ok: false, error: 'verification_rejected' });
    expect(bindings.resolve('conversation_123', 42, '90250', NOW)).toEqual({
      ok: false,
      error: 'conversation_verification_not_found',
    });
  });
});
