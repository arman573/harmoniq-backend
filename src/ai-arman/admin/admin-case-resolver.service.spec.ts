import { AiArmanAdminCaseResolverService } from './admin-case-resolver.service';

describe('AiArmanAdminCaseResolverService', () => {
  function createHarness() {
    const actions = {
      readCase: jest.fn(),
      readOrderContext: jest.fn(),
      sendCustomerMessage: jest.fn(),
      pauseCase: jest.fn(),
      completeCase: jest.fn(),
    } as any;
    const returnActions = {
      setReturnStatus: jest.fn(),
      setProductDecision: jest.fn(),
      createReturnLabel: jest.fn(),
    } as any;
    const assistant = { assist: jest.fn() } as any;
    const replyDraft = { createDraft: jest.fn() } as any;
    return {
      actions,
      returnActions,
      assistant,
      replyDraft,
      service: new AiArmanAdminCaseResolverService(
        actions,
        returnActions,
        assistant,
        replyDraft,
      ),
    };
  }

  it('prepares a solution from authoritative case data instead of browser case facts', async () => {
    const h = createHarness();
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 3,
      data: {
        caseId: 'HQR-12345',
        type: 'claim',
        status: 'active',
        customerName: 'Anna',
        messages: [{ direction: 'inbound', text: 'Min vara är trasig.' }],
      },
    });
    h.actions.readOrderContext.mockResolvedValue({
      ok: true,
      action: 'case.order_context.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 4,
      data: { orderId: '90250', status: 'delivered', trackingNumber: 'ABC123' },
    });
    h.assistant.assist.mockResolvedValue({
      ok: true,
      mode: 'analysis',
      caseSummary: 'Kunden reklamerar en trasig vara.',
      customerNeed: 'Hjälp med reklamationen.',
      recommendedActions: ['Bekräfta mottagen reklamation.'],
      reasoning: 'Ärendet behöver fortsatt handläggning.',
      requiresHumanDecision: false,
      missingFacts: [],
    });
    h.replyDraft.createDraft.mockResolvedValue({
      ok: true,
      draftText: 'Hej Anna! Vi har tagit emot din reklamation.',
      requiresHumanDecision: false,
      decisionReasons: [],
      confidence: 0.9,
    });

    const result = await h.service.prepare({
      caseId: 'hqr-12345',
      status: 'FAKE_BROWSER_STATUS',
      customerName: 'Fake Browser Name',
      messages: [{ text: 'Fake browser message' }],
    });

    expect(h.actions.readCase).toHaveBeenCalledWith('HQR-12345');
    expect(h.assistant.assist).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'HQR-12345',
        caseType: 'claim',
        status: 'active',
        customerName: 'Anna',
      }),
    );
    expect(JSON.stringify(h.assistant.assist.mock.calls[0][0])).not.toContain(
      'FAKE_BROWSER_STATUS',
    );
    expect(result).toMatchObject({
      ok: true,
      mode: 'prepare',
      verifiedCase: true,
      verifiedOrderContext: true,
      draft: {
        subject: 'Angående ditt ärende HQR-12345',
        message: 'Hej Anna! Vi har tagit emot din reklamation.',
      },
      sendsCustomerMessage: false,
      executesWrites: false,
    });
    expect(result.availableActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'case.return_status.set' }),
        expect.objectContaining({ action: 'case.product_decision.set' }),
        expect.objectContaining({ action: 'case.return_label.create' }),
      ]),
    );
  });

  it('still prepares safely when optional model drafting is unavailable', async () => {
    const h = createHarness();
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 3,
      data: { caseId: 'HQR-12345', type: 'support', status: 'active' },
    });
    h.actions.readOrderContext.mockResolvedValue({
      ok: false,
      action: 'case.order_context.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 2,
      error: 'order_context_unavailable',
    });
    h.assistant.assist.mockResolvedValue({
      ok: false,
      code: 'admin_assistant_unavailable',
    });
    h.replyDraft.createDraft.mockRejectedValue(new Error('disabled'));

    const result = await h.service.prepare({ caseId: 'HQR-12345' });

    expect(result).toMatchObject({
      ok: true,
      verifiedCase: true,
      verifiedOrderContext: false,
      analysis: null,
      draft: null,
      sendsCustomerMessage: false,
      executesWrites: false,
    });
  });

  it('blocks execute without explicit approval and performs no write', async () => {
    const h = createHarness();

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: false,
      action: 'case.complete',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'resolver_explicit_approval_required',
      writeExecuted: false,
    });
    expect(h.actions.completeCase).not.toHaveBeenCalled();
    expect(h.actions.readCase).not.toHaveBeenCalled();
  });

  it('rejects actions outside the resolver allowlist', async () => {
    const h = createHarness();

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: true,
      action: 'refund.issue',
      amount: 999,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_resolver_execute_request',
      writeExecuted: false,
    });
    expect(h.actions.sendCustomerMessage).not.toHaveBeenCalled();
    expect(h.actions.pauseCase).not.toHaveBeenCalled();
    expect(h.actions.completeCase).not.toHaveBeenCalled();
    expect(h.returnActions.setReturnStatus).not.toHaveBeenCalled();
    expect(h.returnActions.setProductDecision).not.toHaveBeenCalled();
    expect(h.returnActions.createReturnLabel).not.toHaveBeenCalled();
  });

  it('executes one approved customer message action and verifies the case afterward', async () => {
    const h = createHarness();
    h.actions.sendCustomerMessage.mockResolvedValue({
      ok: true,
      action: 'case.customer_message.send',
      caseId: 'HQR-12345',
      readOnly: false,
      executed: true,
      durationMs: 7,
      data: { ok: true },
    });
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 2,
      data: {
        caseId: 'HQR-12345',
        type: 'claim',
        status: 'active',
        messages: [{ direction: 'outbound', text: 'Hej!' }],
      },
    });

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: true,
      action: 'case.customer_message.send',
      subject: 'Angående ditt ärende',
      message: 'Hej! Vi återkommer i ditt ärende.',
    });

    expect(h.actions.sendCustomerMessage).toHaveBeenCalledWith(
      'HQR-12345',
      'Angående ditt ärende',
      'Hej! Vi återkommer i ditt ärende.',
      true,
    );
    expect(h.actions.readCase).toHaveBeenCalledWith('HQR-12345');
    expect(result).toMatchObject({
      ok: true,
      mode: 'execute',
      action: 'case.customer_message.send',
      writeExecuted: true,
      verifiedAfterWrite: true,
      caseSnapshot: { caseId: 'HQR-12345', messageCount: 1 },
    });
  });

  it('routes an explicitly approved return-label action and verifies afterward', async () => {
    const h = createHarness();
    h.returnActions.createReturnLabel.mockResolvedValue({
      ok: true,
      action: 'case.return_label.create',
      caseId: 'HQR-12345',
      readOnly: false,
      executed: true,
      durationMs: 20,
      data: { ok: true },
    });
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-12345',
      readOnly: true,
      executed: true,
      durationMs: 2,
      data: { caseId: 'HQR-12345', type: 'return', status: 'return_label_pending' },
    });

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: true,
      action: 'case.return_label.create',
    });

    expect(h.returnActions.createReturnLabel).toHaveBeenCalledWith(
      'HQR-12345',
      true,
    );
    expect(result).toMatchObject({
      ok: true,
      action: 'case.return_label.create',
      writeExecuted: true,
      verifiedAfterWrite: true,
    });
  });
});
