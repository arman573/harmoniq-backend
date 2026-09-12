import { ReturnsModuleReadClient } from './returns-module-read.client';
import { ReturnsModuleReadTools } from './returns-module-read.tools';
import {
  RETURNS_MODULE_CONTRACT_VERSION,
  ReturnsModuleVerifiedCustomerContext,
} from './returns-module.types';

function verification(): ReturnsModuleVerifiedCustomerContext {
  return {
    verificationId: 'verify-123',
    verificationMethod: 'order_email_otp',
    subjectHash: 'c'.repeat(64),
    verifiedOrderIds: ['90250'],
    verifiedAt: '2026-08-12T17:55:00.000Z',
    expiresAt: '2026-08-12T18:10:00.000Z',
  };
}

function clientWithCases(cases: any[]) {
  return {
    getCaseContext: jest.fn().mockResolvedValue({
      ok: true,
      configured: true,
      durationMs: 1,
      upstreamStatus: 200,
      response: {
        ok: true,
        contractVersion: RETURNS_MODULE_CONTRACT_VERSION,
        orderId: '90250',
        cases,
      },
    }),
  } as unknown as ReturnsModuleReadClient;
}

describe('ReturnsModuleReadTools', () => {
  it('returns only status fields for getCaseStatus', async () => {
    const client = clientWithCases([
      {
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
            subject: '',
            text: 'Hemligt för statustestet',
            date: '2026-08-12T17:10:00.000Z',
          },
        ],
      },
    ]);

    const result = await new ReturnsModuleReadTools(client).getCaseStatus({
      verification: verification(),
      orderId: '90250',
      caseId: 'HQR-90250',
    });

    expect(result).toEqual({
      ok: true,
      caseId: 'HQR-90250',
      orderId: '90250',
      caseType: 'claim',
      status: 'chat_waiting_admin',
      statusLabel: 'Chat: väntar på admin',
      updatedAt: '2026-08-12T17:30:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('Hemligt för statustestet');
  });

  it('returns only validated public messages for getCaseMessages', async () => {
    const client = clientWithCases([
      {
        caseId: 'HQR-90250',
        orderId: '90250',
        caseType: 'return',
        status: 'return_under_review',
        statusLabel: 'Retur granskas',
        createdAt: '2026-08-12T17:00:00.000Z',
        updatedAt: '2026-08-12T17:30:00.000Z',
        messages: [
          {
            id: 'msg-1',
            direction: 'outbound',
            sender: 'HARMONIQ',
            subject: 'Uppdatering',
            text: 'Vi granskar din retur.',
            date: '2026-08-12T17:20:00.000Z',
          },
        ],
      },
    ]);

    const result = await new ReturnsModuleReadTools(client).getCaseMessages({
      verification: verification(),
      orderId: '90250',
      caseId: 'HQR-90250',
    });

    expect(result).toEqual({
      ok: true,
      caseId: 'HQR-90250',
      orderId: '90250',
      messages: [
        {
          id: 'msg-1',
          direction: 'outbound',
          sender: 'HARMONIQ',
          subject: 'Uppdatering',
          text: 'Vi granskar din retur.',
          date: '2026-08-12T17:20:00.000Z',
        },
      ],
    });
  });

  it('requires an exact case when an order has multiple cases', async () => {
    const cases = ['HQR-90250-A', 'HQR-90250-B'].map((caseId) => ({
      caseId,
      orderId: '90250',
      caseType: 'support',
      status: 'chat_waiting_admin',
      statusLabel: 'Chat: väntar på admin',
      createdAt: '2026-08-12T17:00:00.000Z',
      updatedAt: '2026-08-12T17:30:00.000Z',
      messages: [],
    }));

    const result = await new ReturnsModuleReadTools(
      clientWithCases(cases),
    ).getCaseStatus({
      verification: verification(),
      orderId: '90250',
    });

    expect(result).toEqual({
      ok: false,
      error: 'case_selection_ambiguous',
    });
  });

  it('maps all client failures to a bounded unavailable result', async () => {
    const client = {
      getCaseContext: jest.fn().mockResolvedValue({
        ok: false,
        configured: true,
        durationMs: 1,
        error: 'returns_module_upstream_error',
      }),
    } as unknown as ReturnsModuleReadClient;

    const result = await new ReturnsModuleReadTools(client).getCaseMessages({
      verification: verification(),
      orderId: '90250',
      caseId: 'HQR-90250',
    });

    expect(result).toEqual({
      ok: false,
      error: 'returns_module_unavailable',
    });
  });
});
