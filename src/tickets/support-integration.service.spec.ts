import { SupportIntegrationService } from './support-integration.service';

describe('SupportIntegrationService', () => {
  it('reports support integration capabilities as not configured', () => {
    const service = new SupportIntegrationService();

    expect(service.getCapabilities()).toEqual(
      expect.arrayContaining([
        { capability: 'order_lookup', status: 'not_configured' },
        { capability: 'return_request', status: 'not_configured' },
        { capability: 'human_support_handoff', status: 'not_configured' },
      ]),
    );
    expect(service.getCapabilityStatus('order_lookup')).toEqual({
      capability: 'order_lookup',
      status: 'not_configured',
      available: false,
    });
  });

  it('returns an order lookup placeholder without inventing order data', () => {
    const service = new SupportIntegrationService();

    const result = service.lookupOrder({
      customerId: 1,
      orderNumber: 'ORDER-123',
      email: 'ada@example.com',
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'not_configured',
        capability: 'order_lookup',
        handled: false,
        requiresHuman: true,
        missingFields: [],
        safeCustomerMessage: expect.stringContaining('not connected yet'),
      }),
    );
    expect(result.externalReference).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('ORDER-123');
    expect(JSON.stringify(result)).not.toContain('shipped');
    expect(JSON.stringify(result)).not.toContain('refund');
  });

  it('infers safe support capabilities from message text only', () => {
    const service = new SupportIntegrationService();

    expect(
      service.inferCapability({ message: 'Can I return this product?' }),
    ).toBe('return_request');
    expect(
      service.inferCapability({ message: 'I got the wrong product' }),
    ).toBe('claim_wrong_product');
    expect(service.inferCapability({ message: 'The bottle is damaged' })).toBe(
      'claim_damaged_product',
    );
    expect(service.inferCapability({ message: 'Where is my delivery?' })).toBe(
      'shipping_tracking',
    );
    expect(service.inferCapability({ message: 'I need support' })).toBe(
      'human_support_handoff',
    );
  });
});
