import { classifyMail } from './mail-agent.classifier';

describe('HARMONIQ mail no-miss policy', () => {
  it('never treats an invoice-like message as newsletter noise', () => {
    const result = classifyMail({
      mailbox: 'ekonomi@harmoniq.se',
      providerMessageId: 'invoice-1',
      from: 'billing@supplier.example',
      subject: 'Faktura 2615963',
      body: 'Bifogat finns er faktura med förfallodatum 2026-09-30.',
    });

    expect(result.category).toBe('invoice_finance');
    expect(result.nextAction).toBe('route_finance');
    expect(result.priority).not.toBe('low');
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.automationAllowed).toBe(false);
  });

  it('surfaces payment reminders as critical when collections are involved', () => {
    const result = classifyMail({
      mailbox: 'arman@harmoniq.se',
      providerMessageId: 'collection-1',
      from: 'collections@example.com',
      subject: 'Inkasso - fakturan förfaller snart',
      body: 'Betalning krävs.',
    });

    expect(result.category).toBe('invoice_finance');
    expect(result.priority).toBe('critical');
  });

  it('routes supplier shipment messages to supplier operations', () => {
    const result = classifyMail({
      mailbox: 'inkop@harmoniq.se',
      providerMessageId: 'ship-1',
      from: 'supplier@example.com',
      subject: 'A shipment for order 4MZEKWW is on its way',
      body: 'Your shipment has left our warehouse.',
    });

    expect(result.category).toBe('order_purchase');
    expect(result.specialist).toBe('supplier-ops');
  });
});
