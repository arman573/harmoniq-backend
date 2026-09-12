import { AiArmanAdminReturnResolutionActionsService } from './admin-return-resolution-actions.service';

describe('AiArmanAdminReturnResolutionActionsService', () => {
  it('maps an approved return status to the exact Returns Module status route', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 11,
        upstreamStatus: 200,
        requestId: 'req-status',
        method: 'POST',
        path: '/api/admin/cases/HQR-12345/status',
        contentType: 'application/json',
        isWrite: true,
        body: { ok: true, case: { status: 'return_received' } },
      }),
    } as any;
    const service = new AiArmanAdminReturnResolutionActionsService(gateway);

    const result = await service.setReturnStatus(
      'hqr-12345',
      'return_received',
      'Returen verifierad som mottagen.',
      true,
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'case.return_status.set',
      executed: true,
    });
    expect(gateway.execute).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/admin/cases/HQR-12345/status',
      body: {
        status: 'return_received',
        note: 'Returen verifierad som mottagen.',
      },
      reason:
        'Set explicitly approved return status return_received for HQR-12345',
      explicitAdminApproval: true,
    });
  });

  it('rejects statuses outside the Returns Module allowlist before gateway execution', async () => {
    const gateway = { execute: jest.fn() } as any;
    const service = new AiArmanAdminReturnResolutionActionsService(gateway);

    const result = await service.setReturnStatus(
      'HQR-12345',
      'refund_everything',
      '',
      true,
    );

    expect(result).toMatchObject({
      ok: false,
      executed: false,
      error: 'invalid_return_status',
    });
    expect(gateway.execute).not.toHaveBeenCalled();
  });

  it('requires a reason when explicitly rejecting a product', async () => {
    const gateway = { execute: jest.fn() } as any;
    const service = new AiArmanAdminReturnResolutionActionsService(gateway);

    const result = await service.setProductDecision(
      'HQR-12345',
      0,
      'rejected',
      '',
      '',
      true,
    );

    expect(result).toMatchObject({
      ok: false,
      executed: false,
      error: 'reject_reason_required',
    });
    expect(gateway.execute).not.toHaveBeenCalled();
  });

  it('maps an approved product decision to the exact product decision route', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 8,
        upstreamStatus: 200,
        requestId: 'req-product',
        method: 'PATCH',
        path: '/api/admin/cases/HQR-12345/products/1/decision',
        contentType: 'application/json',
        isWrite: true,
        body: { ok: true },
      }),
    } as any;
    const service = new AiArmanAdminReturnResolutionActionsService(gateway);

    const result = await service.setProductDecision(
      'HQR-12345',
      1,
      'approved',
      '',
      'Godkänt av admin efter granskning.',
      true,
    );

    expect(result.ok).toBe(true);
    expect(gateway.execute).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/api/admin/cases/HQR-12345/products/1/decision',
      body: {
        decision: 'approved',
        rejectReason: '',
        adminNote: 'Godkänt av admin efter granskning.',
      },
      reason:
        'Set explicitly approved product decision approved for HQR-12345 product 1',
      explicitAdminApproval: true,
    });
  });

  it('creates a return label with no browser-supplied address or shipment payload', async () => {
    const gateway = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        configured: true,
        durationMs: 22,
        upstreamStatus: 200,
        requestId: 'req-label',
        method: 'POST',
        path: '/api/admin/cases/HQR-12345/return-label',
        contentType: 'application/json',
        isWrite: true,
        body: { ok: true, returnLabel: { provider: 'nshift' } },
      }),
    } as any;
    const service = new AiArmanAdminReturnResolutionActionsService(gateway);

    const result = await service.createReturnLabel('HQR-12345', true);

    expect(result).toMatchObject({
      ok: true,
      action: 'case.return_label.create',
      executed: true,
    });
    expect(gateway.execute).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/admin/cases/HQR-12345/return-label',
      body: {},
      reason:
        'Create explicitly approved return label for HQR-12345 using authoritative Returns Module case data',
      explicitAdminApproval: true,
    });
  });
});
