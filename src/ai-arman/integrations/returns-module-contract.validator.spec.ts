import {
  parseReturnsModuleCaseContextResponse,
  validateReturnsModuleCaseContextRequest,
  validateReturnsModuleVerifiedContext,
  validateReturnsModuleWriteAuthorization,
} from './returns-module-contract.validator';
import { RETURNS_MODULE_CONTRACT_VERSION } from './returns-module.types';

const NOW = new Date('2026-08-12T18:00:00.000Z');

function verification(overrides: Record<string, unknown> = {}) {
  return {
    verificationId: 'verify-123',
    verificationMethod: 'order_email_otp' as const,
    subjectHash: 'a'.repeat(64),
    verifiedOrderIds: ['90250'],
    verifiedAt: '2026-08-12T17:55:00.000Z',
    expiresAt: '2026-08-12T18:10:00.000Z',
    ...overrides,
  };
}

function responseCase(overrides: Record<string, unknown> = {}) {
  return {
    caseId: 'HQR-90250',
    orderId: '90250',
    caseType: 'claim',
    status: 'chat_waiting_admin',
    statusLabel: 'Chat: väntar på admin',
    createdAt: '2026-08-12T17:00:00.000Z',
    updatedAt: '2026-08-12T17:30:00.000Z',
    messages: [
      {
        id: 'msg-1',
        direction: 'inbound',
        sender: 'Kund',
        subject: 'Reklamation',
        text: 'Produkten kom trasig.',
        date: '2026-08-12T17:10:00.000Z',
      },
      {
        id: 'msg-2',
        direction: 'outbound',
        sender: 'HARMONIQ',
        subject: 'Reklamation',
        text: 'Tack, vi granskar ärendet.',
        date: '2026-08-12T17:20:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('Returns Module contract validator v1', () => {
  it('accepts a live verified customer context bound to the requested order', () => {
    expect(validateReturnsModuleVerifiedContext(verification(), '90250', NOW)).toBe(true);
  });

  it.each([
    ['expired context', { expiresAt: '2026-08-12T17:59:59.000Z' }],
    ['wrong order', { verifiedOrderIds: ['90251'] }],
    ['invalid subject hash', { subjectHash: 'customer@example.com' }],
    ['future verification', { verifiedAt: '2026-08-12T18:02:00.000Z' }],
    ['unsupported verification method', { verificationMethod: 'free_text_customer_id' }],
  ])('fails closed for %s', (_label, overrides) => {
    expect(
      validateReturnsModuleVerifiedContext(
        verification(overrides) as ReturnType<typeof verification>,
        '90250',
        NOW,
      ),
    ).toBe(false);
  });

  it('validates a case context request only when the order is verified', () => {
    expect(
      validateReturnsModuleCaseContextRequest(
        {
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          verification: verification(),
          orderId: '90250',
          caseId: 'HQR-90250',
        },
        NOW,
      ),
    ).toBe(true);

    expect(
      validateReturnsModuleCaseContextRequest(
        {
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          verification: verification(),
          orderId: '90251',
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('requires action confirmation and idempotency for future writes', () => {
    expect(
      validateReturnsModuleWriteAuthorization(
        {
          verification: verification(),
          confirmationToken: 'confirm-create-claim-123',
          idempotencyKey: 'conversation-1:message-9:create-claim',
        },
        '90250',
        NOW,
      ),
    ).toBe(true);

    expect(
      validateReturnsModuleWriteAuthorization(
        {
          verification: verification(),
          confirmationToken: '',
          idempotencyKey: 'conversation-1:message-9:create-claim',
        },
        '90250',
        NOW,
      ),
    ).toBe(false);

    expect(
      validateReturnsModuleWriteAuthorization(
        {
          verification: verification(),
          confirmationToken: 'confirm-create-claim-123',
          idempotencyKey: '',
        },
        '90250',
        NOW,
      ),
    ).toBe(false);
  });

  it('parses the customer-safe case projection and drops unrelated fields by construction', () => {
    const parsed = parseReturnsModuleCaseContextResponse(
      {
        ok: true,
        contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
        orderId: '90250',
        customerEmail: 'must-not-enter-model@example.com',
        deliveryAddress: { address1: 'Secret Street 1' },
        adminToken: 'secret-admin-token',
        cases: [
          {
            ...responseCase(),
            internalAdminNote: 'Do not expose',
            statusHistory: [{ note: 'internal workflow history' }],
            adminWorkQueueState: 'active',
            returnLabel: { downloadCode: 'secret-code' },
          },
        ],
      },
      '90250',
    );

    expect(parsed).toEqual({
      ok: true,
      contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
      orderId: '90250',
      cases: [responseCase()],
    });
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('must-not-enter-model@example.com');
    expect(serialized).not.toContain('Secret Street 1');
    expect(serialized).not.toContain('secret-admin-token');
    expect(serialized).not.toContain('internal workflow history');
    expect(serialized).not.toContain('secret-code');
    expect(serialized).not.toContain('adminWorkQueueState');
  });

  it('fails closed when a returned case belongs to a different order', () => {
    expect(
      parseReturnsModuleCaseContextResponse(
        {
          ok: true,
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          orderId: '90250',
          cases: [responseCase({ orderId: '90251' })],
        },
        '90250',
      ),
    ).toBeNull();
  });

  it('fails closed for non-public message directions or mismatched senders', () => {
    expect(
      parseReturnsModuleCaseContextResponse(
        {
          ok: true,
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          orderId: '90250',
          cases: [
            responseCase({
              messages: [
                {
                  id: 'msg-internal',
                  direction: 'internal',
                  sender: 'Admin',
                  subject: 'Intern notering',
                  text: 'Do not expose',
                  date: '2026-08-12T17:10:00.000Z',
                },
              ],
            }),
          ],
        },
        '90250',
      ),
    ).toBeNull();

    expect(
      parseReturnsModuleCaseContextResponse(
        {
          ok: true,
          contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
          orderId: '90250',
          cases: [
            responseCase({
              messages: [
                {
                  id: 'msg-wrong-sender',
                  direction: 'inbound',
                  sender: 'HARMONIQ',
                  subject: '',
                  text: 'Wrong direction/sender pair',
                  date: '2026-08-12T17:10:00.000Z',
                },
              ],
            }),
          ],
        },
        '90250',
      ),
    ).toBeNull();
  });

  it('fails closed for excessive messages, oversized text or unsafe case types', () => {
    const messages = Array.from({ length: 41 }, (_, index) => ({
      id: `msg-${index}`,
      direction: 'inbound',
      sender: 'Kund',
      subject: '',
      text: 'Hej',
      date: '2026-08-12T17:10:00.000Z',
    }));

    for (const item of [
      responseCase({ messages }),
      responseCase({ messages: [{ ...responseCase().messages[0], text: 'x'.repeat(3001) }] }),
      responseCase({ caseType: 'shipping_damage' }),
    ]) {
      expect(
        parseReturnsModuleCaseContextResponse(
          {
            ok: true,
            contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
            orderId: '90250',
            cases: [item],
          },
          '90250',
        ),
      ).toBeNull();
    }
  });

  it('has no evidence or attachment capability in the v1 contract', async () => {
    const contract = await import('./returns-module.types');
    expect(Object.keys(contract)).not.toContain('add_case_evidence');
    expect(Object.keys(contract)).not.toContain('upload_attachment');
  });
});
