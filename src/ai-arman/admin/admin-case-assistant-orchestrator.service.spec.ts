import { AiArmanAdminCaseAssistantOrchestratorService } from './admin-case-assistant-orchestrator.service';
import { AiArmanAdminCommandPlannerService } from './admin-command-planner.service';

function disabledActions() {
  return {
    readCase: jest.fn(async () => ({
      ok: false,
      action: 'case.read',
      caseId: 'HQR-TEST',
      readOnly: true,
      executed: false,
      durationMs: 0,
      error: 'returns_admin_gateway_disabled',
    })),
    readOrderContext: jest.fn(async () => ({
      ok: false,
      action: 'case.order_context.read',
      caseId: 'HQR-TEST',
      readOnly: true,
      executed: false,
      durationMs: 0,
      error: 'returns_admin_gateway_disabled',
    })),
    pauseCase: jest.fn(),
    completeCase: jest.fn(),
  };
}

describe('AiArmanAdminCaseAssistantOrchestratorService', () => {
  it('falls back to direct order and tracking reads when admin gateway order context is unavailable', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(async () => ({
        name: 'order.read', ok: true, readOnly: true, source: 'vendre', durationMs: 5,
        data: { orderId: '2494077', status: 'Skickad', dispatchState: 'dispatched' },
      })),
      readTracking: jest.fn(async () => ({
        name: 'tracking.read', ok: true, readOnly: true, source: 'nshift_vendre', durationMs: 7,
        data: { orderId: '2494077', carrier: 'DB Schenker', parcelNo: 'ABC123', trackingUrl: 'https://example.test/track' },
      })),
      readProductIntelligence: jest.fn(),
    };
    const actions = disabledActions();
    const assistant = {
      assist: jest.fn(async () => ({
        ok: true,
        mode: 'discussion',
        answerToAdmin: 'Sändnings-ID finns.',
        sendsCustomerMessage: false,
        executesWrites: false,
      })),
    };

    const service = new AiArmanAdminCaseAssistantOrchestratorService(
      tools as never,
      actions as never,
      new AiArmanAdminCommandPlannerService(),
      assistant as never,
    );
    const result = await service.assist({
      caseId: 'HQR-2494077',
      caseType: 'support',
      status: 'chat_waiting_admin',
      orderId: '2494077',
      adminQuestion: 'Kan du kontrollera sändnings-ID och tracking?',
      messages: [{ direction: 'inbound', text: 'Hej, kan jag få Sändnings-ID?' }],
    });

    expect(actions.readOrderContext).toHaveBeenCalledWith('HQR-2494077');
    expect(tools.readOrder).toHaveBeenCalledWith('2494077');
    expect(tools.readTracking).toHaveBeenCalledWith('2494077');
    expect(tools.readProductIntelligence).not.toHaveBeenCalled();
    const modelInput = assistant.assist.mock.calls[0][0] as { messages: Array<Record<string, unknown>> };
    const verified = modelInput.messages.at(-1) as Record<string, unknown>;
    expect(verified.sender).toBe('VERIFIERADE SYSTEMFAKTA');
    expect(String(verified.text)).toContain('ABC123');
    expect(result).toMatchObject({
      ok: true,
      verifiedFactsAvailable: true,
      writeExecuted: false,
    });
  });

  it('uses enriched gateway order context instead of duplicate direct order and tracking reads', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(),
      readTracking: jest.fn(),
      readProductIntelligence: jest.fn(),
    };
    const actions = disabledActions();
    actions.readOrderContext.mockResolvedValueOnce({
      ok: true,
      action: 'case.order_context.read',
      caseId: 'HQR-2494077',
      readOnly: true,
      executed: true,
      durationMs: 12,
      data: { ok: true, orderId: '2494077', tracking: { available: true } },
    } as never);
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(
      tools as never,
      actions as never,
      new AiArmanAdminCommandPlannerService(),
      assistant as never,
    );

    const result = await service.assist({
      caseId: 'HQR-2494077',
      caseType: 'support',
      orderId: '2494077',
      adminQuestion: 'Kontrollera tracking och leverans för ärendet.',
      messages: [],
    });

    expect(tools.readOrder).not.toHaveBeenCalled();
    expect(tools.readTracking).not.toHaveBeenCalled();
    expect(result).toMatchObject({ verifiedFactsAvailable: true, writeExecuted: false });
  });

  it('executes an explicit pause command and reports the completed write to the model', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(),
      readTracking: jest.fn(),
      readProductIntelligence: jest.fn(),
    };
    const actions = disabledActions();
    actions.pauseCase.mockResolvedValueOnce({
      ok: true,
      action: 'case.pause',
      caseId: 'HQR-12345',
      readOnly: false,
      executed: true,
      durationMs: 8,
      data: { ok: true, adminWorkQueueState: 'waiting' },
    });
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(
      tools as never,
      actions as never,
      new AiArmanAdminCommandPlannerService(),
      assistant as never,
    );

    const result = await service.assist({
      caseId: 'HQR-12345',
      caseType: 'support',
      adminQuestion: 'Öppna HQR-12345 och pausa ärendet.',
      messages: [],
    });

    expect(actions.pauseCase).toHaveBeenCalledWith('HQR-12345', true);
    expect(result).toMatchObject({ writeExecuted: true });
    const modelInput = assistant.assist.mock.calls[0][0] as { messages: Array<Record<string, unknown>> };
    expect(String(modelInput.messages.at(-1)?.text)).toContain('case.pause');
    expect(String(modelInput.messages.at(-1)?.text)).toContain('"executed":true');
  });

  it('does not execute a deliberative pause question', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(), readTracking: jest.fn(), readProductIntelligence: jest.fn(),
    };
    const actions = disabledActions();
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(
      tools as never,
      actions as never,
      new AiArmanAdminCommandPlannerService(),
      assistant as never,
    );

    await service.assist({
      caseId: 'HQR-12345',
      caseType: 'support',
      adminQuestion: 'Borde vi pausa ärendet?',
      messages: [],
    });

    expect(actions.pauseCase).not.toHaveBeenCalled();
    expect(actions.completeCase).not.toHaveBeenCalled();
  });

  it('runs product intelligence for product questions', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(),
      readTracking: jest.fn(),
      readProductIntelligence: jest.fn(async () => ({
        name: 'product.intelligence', ok: true, readOnly: true, source: 'product_intelligence', durationMs: 10,
        data: { analyses: [{ productId: '42729' }] },
      })),
    };
    const actions = disabledActions();
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(
      tools as never,
      actions as never,
      new AiArmanAdminCommandPlannerService(),
      assistant as never,
    );

    await service.assist({
      caseId: 'HQR-42729',
      caseType: 'claim',
      adminQuestion: 'Kan du kontrollera produktens ingredienser?',
      products: [{ productId: '42729', title: 'Super Gentle Wash' }],
      messages: [],
    });

    expect(tools.readProductIntelligence).toHaveBeenCalledTimes(1);
    expect(tools.readOrder).not.toHaveBeenCalled();
    expect(tools.readTracking).not.toHaveBeenCalled();
  });
});
