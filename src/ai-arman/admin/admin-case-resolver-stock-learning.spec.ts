import { AiArmanAdminCaseResolverService } from './admin-case-resolver.service';

describe('AI Arman verified stock and reply learning', () => {
  function harness() {
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

  it('projects authoritative nested order lines and computes a verified stock shortfall', async () => {
    const h = harness();
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-2493528',
      readOnly: true,
      executed: true,
      durationMs: 1,
      data: {
        caseId: 'HQR-2493528',
        type: 'support',
        status: 'active',
        messages: [{ direction: 'inbound', text: 'När skickas min beställning?' }],
      },
    });
    h.actions.readOrderContext.mockResolvedValue({
      ok: true,
      action: 'case.order_context.read',
      caseId: 'HQR-2493528',
      readOnly: true,
      executed: true,
      durationMs: 1,
      data: {
        ok: true,
        orderId: '2493528',
        order: {
          id: '2493528',
          status: 'Behandlas',
          products: [{
            id: '50123',
            model: '115',
            name: 'Testprodukt',
            quantity: 3,
            stockVerified: true,
            stockQuantity: 1,
          }],
        },
        tracking: { available: false, source: 'fallback' },
      },
    });
    h.assistant.assist.mockResolvedValue({ ok: false, code: 'test_stop_after_projection' });

    await h.service.prepare({ caseId: 'HQR-2493528' });

    expect(h.assistant.assist).toHaveBeenCalledTimes(1);
    const payload = h.assistant.assist.mock.calls[0][0];
    const verifiedFacts = payload.messages.find((item: any) => item.sender === 'VERIFIERADE ORDERFAKTA');
    expect(verifiedFacts).toBeTruthy();
    const facts = JSON.parse(verifiedFacts.text);
    expect(facts).toMatchObject({
      orderId: '2493528',
      products: [{
        id: '50123',
        orderedQuantity: 3,
        stockVerified: true,
        stockQuantity: 1,
        fulfillableQuantity: 1,
        shortfallQuantity: 2,
        canFulfillOrderedQuantity: false,
      }],
      tracking: { available: false },
    });
  });

  it('turns a private stock note into a safe reusable stock rule without sending the note to the customer', async () => {
    const h = harness();
    h.actions.sendCustomerMessage.mockResolvedValue({
      ok: true,
      action: 'case.customer_message.send',
      caseId: 'HQR-2493528',
      readOnly: false,
      executed: true,
      durationMs: 1,
      data: { ok: true },
    });
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-2493528',
      readOnly: true,
      executed: true,
      durationMs: 1,
      data: { caseId: 'HQR-2493528', type: 'support', status: 'active' },
    });
    h.learning.save.mockResolvedValue({ id: 'learn-stock-1' });
    const privateNote = 'Vi har bara 1 av denna därav svaret';

    await h.service.execute({
      caseId: 'HQR-2493528',
      approved: true,
      action: 'case.customer_message.send',
      subject: 'Angående ditt ärende',
      message: 'Vi väntar in resterande antal innan hela beställningen kan skickas.',
      learnFromReply: true,
      internalLearningNote: privateNote,
    });

    expect(JSON.stringify(h.actions.sendCustomerMessage.mock.calls)).not.toContain(privateNote);
    expect(h.learning.save).toHaveBeenCalledWith(expect.objectContaining({
      internalRationale: privateNote,
      principle: expect.stringContaining('lagersaldot är lägre än kundens beställda antal'),
      appliesWhen: expect.stringContaining('stockVerified=true'),
      avoid: expect.stringContaining('Återanvänd aldrig gamla lagersiffror'),
    }));
  });

  it('turns a private supplier-delay note into a rule that requires newly verified supplier facts', async () => {
    const h = harness();
    h.actions.sendCustomerMessage.mockResolvedValue({
      ok: true,
      action: 'case.customer_message.send',
      caseId: 'HQR-2492572',
      readOnly: false,
      executed: true,
      durationMs: 1,
      data: { ok: true },
    });
    h.actions.readCase.mockResolvedValue({
      ok: true,
      action: 'case.read',
      caseId: 'HQR-2492572',
      readOnly: true,
      executed: true,
      durationMs: 1,
      data: { caseId: 'HQR-2492572', type: 'support', status: 'active' },
    });
    h.learning.save.mockResolvedValue({ id: 'learn-supplier-1' });

    await h.service.execute({
      caseId: 'HQR-2492572',
      approved: true,
      action: 'case.customer_message.send',
      subject: 'Angående ditt ärende',
      message: 'Den är försenad men väntas in under veckan.',
      learnFromReply: true,
      internalLearningNote: 'denna är försenad fr lev så vi säger att den kommer till kunden under veckan',
    });

    expect(h.learning.save).toHaveBeenCalledWith(expect.objectContaining({
      principle: expect.stringContaining('verifierad leverantörs- eller inleveransdata'),
      appliesWhen: expect.stringContaining('aktuell verifierad backendkontext'),
      avoid: expect.stringContaining('Återanvänd aldrig en gammal leveransvecka'),
    }));
  });
});
