import { AiArmanAdminActionService } from './admin-action.service';

describe('AiArmanAdminActionService', () => {
  it('filters an exact case from the authoritative case list', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 12,
        upstreamStatus: 200,
        requestId: 'req-1',
        method: 'GET',
        path: '/api/cases',
        contentType: 'application/json',
        isWrite: false,
        body: {
          ok: true,
          cases: [
            { caseId: 'HQR-11111', status: 'old' },
            { caseId: 'HQR-2494077', status: 'active', messages: [{ text: 'Hej' }] },
          ],
        },
      }),
    } as any;
    const service = new AiArmanAdminActionService(gateway);

    const result = await service.readCase('hqr-2494077');

    expect(result).toMatchObject({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-2494077',
      readOnly: true,
      executed: true,
      data: { caseId: 'HQR-2494077', status: 'active' },
    });
  });

  it('uses the existing enriched order-context route', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 18,
        upstreamStatus: 200,
        requestId: 'req-2',
        method: 'GET',
        path: '/api/admin/cases/HQR-2494077/order-context',
        contentType: 'application/json',
        isWrite: false,
        body: { ok: true, orderId: '2494077', tracking: { available: true } },
      }),
    } as any;
    const service = new AiArmanAdminActionService(gateway);

    const result = await service.readOrderContext('HQR-2494077');

    expect(result.ok).toBe(true);
    expect(gateway.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/admin/cases/HQR-2494077/order-context',
      }),
    );
  });

  it('maps an approved customer message to the existing returns send route', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 15,
        upstreamStatus: 200,
        requestId: 'req-message',
        method: 'POST',
        path: '/api/admin/cases/HQR-12345/messages/send',
        contentType: 'application/json',
        isWrite: true,
        body: { ok: true },
      }),
    } as any;
    const service = new AiArmanAdminActionService(gateway);

    const result = await service.sendCustomerMessage(
      'hqr-12345',
      'Angående ditt ärende',
      'Hej! Vi har nu kontrollerat ditt ärende.',
      true,
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'case.customer_message.send',
      caseId: 'HQR-12345',
      readOnly: false,
      executed: true,
    });
    expect(gateway.execute).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/admin/cases/HQR-12345/messages/send',
      body: {
        subject: 'Angående ditt ärende',
        message: 'Hej! Vi har nu kontrollerat ditt ärende.',
      },
      reason: 'Send explicitly approved customer message for HQR-12345',
      explicitAdminApproval: true,
    });
  });

  it('rejects an invalid customer message before the gateway is called', async () => {
    const gateway = { execute: jest.fn() } as any;
    const service = new AiArmanAdminActionService(gateway);

    const result = await service.sendCustomerMessage(
      'HQR-12345',
      '<b></b>',
      '<div></div>',
      true,
    );

    expect(result).toMatchObject({
      ok: false,
      action: 'case.customer_message.send',
      executed: false,
      error: 'invalid_customer_message',
    });
    expect(gateway.execute).not.toHaveBeenCalled();
  });

  it('maps pause to the exact work queue route and forwards explicit approval', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 9,
        upstreamStatus: 200,
        requestId: 'req-3',
        method: 'PATCH',
        path: '/api/admin/cases/HQR-12345/work-queue',
        contentType: 'application/json',
        isWrite: true,
        body: { ok: true, adminWorkQueueState: 'waiting' },
      }),
    } as any;
    const service = new AiArmanAdminActionService(gateway);

    const result = await service.pauseCase('HQR-12345', true);

    expect(result).toMatchObject({ ok: true, action: 'case.pause', readOnly: false });
    expect(gateway.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        path: '/api/admin/cases/HQR-12345/work-queue',
        body: { queueState: 'waiting' },
        explicitAdminApproval: true,
      }),
    );
  });
});
