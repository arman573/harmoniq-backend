import { AiArmanAdminCaseAssistantOrchestratorService } from './admin-case-assistant-orchestrator.service';

describe('AiArmanAdminCaseAssistantOrchestratorService', () => {
  it('runs order and tracking reads for a tracking case and injects verified system facts', async () => {
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
      toolsUsed: [
        { tool: 'case.read', ok: true },
        { tool: 'order.read', ok: true },
        { tool: 'tracking.read', ok: true },
      ],
    });
  });

  it('does not run external reads when the case does not require them', async () => {
    const tools = {
      readCase: jest.fn(async (data) => ({
        name: 'case.read', ok: true, readOnly: true, source: 'returns_module', durationMs: 0, data,
      })),
      readOrder: jest.fn(),
      readTracking: jest.fn(),
      readProductIntelligence: jest.fn(),
    };
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(tools as never, assistant as never);

    await service.assist({
      caseId: 'HQR-12345',
      caseType: 'support',
      orderId: '12345',
      adminQuestion: 'Hur ska tonen i svaret vara?',
      messages: [{ direction: 'inbound', text: 'Tack för hjälpen.' }],
    });

    expect(tools.readOrder).not.toHaveBeenCalled();
    expect(tools.readTracking).not.toHaveBeenCalled();
    expect(tools.readProductIntelligence).not.toHaveBeenCalled();
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
    const assistant = { assist: jest.fn(async () => ({ ok: true, sendsCustomerMessage: false, executesWrites: false })) };
    const service = new AiArmanAdminCaseAssistantOrchestratorService(tools as never, assistant as never);

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
