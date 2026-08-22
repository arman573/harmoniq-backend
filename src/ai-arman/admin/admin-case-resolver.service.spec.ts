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
    const learning = { save: jest.fn(), listRelevant: jest.fn() } as any;
    return {
      actions,
      returnActions,
      assistant,
      learning,
      service: new AiArmanAdminCaseResolverService(
        actions,
        returnActions,
        assistant,
        learning,
      ),
    };
  }

  it('prepares analysis and draft from one assistant pass using authoritative data', async () => {
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
      replyDraft: {
        draftText: 'Självklart vännen, jag hjälper dig med det här 🤍',
        requiresHumanDecision: false,
        decisionReasons: [],
        confidence: 0.9,
      },
    });

    const result = await h.service.prepare({
      caseId: 'hqr-12345',
      status: 'FAKE_BROWSER_STATUS',
      customerName: 'Fake Browser Name',
      messages: [{ text: 'Fake browser message' }],
    });

    expect(h.actions.readCase).toHaveBeenCalledWith('HQR-12345');
    expect(h.actions.readOrderContext).toHaveBeenCalledWith('HQR-12345');
    expect(h.assistant.assist).toHaveBeenCalledTimes(1);
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
        message: 'Självklart vännen, jag hjälper dig med det här 🤍',
      },
      sendsCustomerMessage: false,
      executesWrites: false,
    });
  });

  it('still prepares safely when model analysis is unavailable', async () => {
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

  it('keeps internal rationale out of customer transport and saves it only after approved send', async () => {
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
        type: 'order_issue',
        status: 'active',
        messages: [{ direction: 'outbound', text: 'Vi löser det här.' }],
      },
    });
    h.learning.save.mockResolvedValue({ id: 'learn-1' });
    const privateNote = 'Vendre har översålt lagret. Den interna orsaken får kunden aldrig veta.';

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: true,
      action: 'case.customer_message.send',
      subject: 'Angående ditt ärende',
      message: 'Vi har haft strul i systemet men löser det här åt dig.',
      learnFromReply: true,
      internalLearningNote: privateNote,
    });

    expect(h.actions.sendCustomerMessage).toHaveBeenCalledTimes(1);
    expect(h.actions.sendCustomerMessage).toHaveBeenCalledWith(
      'HQR-12345',
      'Angående ditt ärende',
      'Vi har haft strul i systemet men löser det här åt dig.',
      true,
    );
    expect(JSON.stringify(h.actions.sendCustomerMessage.mock.calls)).not.toContain(privateNote);
    expect(h.learning.save).toHaveBeenCalledWith(expect.objectContaining({
      caseType: 'order_issue',
      approvedReplyExample: 'Vi har haft strul i systemet men löser det här åt dig.',
      internalRationale: privateNote,
    }));
    expect(result).toMatchObject({
      ok: true,
      writeExecuted: true,
      learningRequested: true,
      learningSaved: true,
      learningId: 'learn-1',
    });
  });

  it('never retries customer send when private learning persistence fails', async () => {
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
      data: { caseId: 'HQR-12345', type: 'support', status: 'active' },
    });
    h.learning.save.mockRejectedValue(new Error('admin_learning_storage_unavailable'));

    const result = await h.service.execute({
      caseId: 'HQR-12345',
      approved: true,
      action: 'case.customer_message.send',
      subject: 'Angående ditt ärende',
      message: 'Jag hjälper dig med det här.',
      learnFromReply: true,
      internalLearningNote: 'Intern förklaring som inte får skickas.',
    });

    expect(h.actions.sendCustomerMessage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      writeExecuted: true,
      learningRequested: true,
      learningSaved: false,
      learningError: 'admin_learning_storage_unavailable',
    });
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
      message: 'Vi återkommer i ditt ärende.',
    });

    expect(h.actions.sendCustomerMessage).toHaveBeenCalledWith(
      'HQR-12345',
      'Angående ditt ärende',
      'Vi återkommer i ditt ärende.',
      true,
    );
    expect(h.actions.readCase).toHaveBeenCalledWith('HQR-12345');
    expect(h.learning.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      mode: 'execute',
      action: 'case.customer_message.send',
      writeExecuted: true,
      verifiedAfterWrite: true,
      caseSnapshot: { caseId: 'HQR-12345', messageCount: 1 },
      learningRequested: false,
      learningSaved: false,
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

    expect(h.returnActions.createReturnLabel).toHaveBeenCalledWith('HQR-12345', true);
    expect(result).toMatchObject({
      ok: true,
      action: 'case.return_label.create',
      writeExecuted: true,
      verifiedAfterWrite: true,
    });
  });
});
