import { evaluateCustomerGatewayBoundary } from './ai-arman-customer-gateway-boundary';

describe('AI Arman customer gateway boundary', () => {
  it('allows only the explicit public customer surface', () => {
    expect(
      evaluateCustomerGatewayBoundary({
        method: 'GET',
        path: '/ai-arman/customer/widget.js',
      }),
    ).toEqual({ allowed: true });
    expect(
      evaluateCustomerGatewayBoundary({
        method: 'POST',
        path: '/ai-arman/customer/identity/start',
        origin: 'https://harmoniq.se',
      }),
    ).toEqual({ allowed: true });
  });

  it.each([
    '/ai-arman/foundation',
    '/ai-arman/internal-preview',
    '/ai-arman/internal-preview/diagnostics',
    '/ai-arman/widget/beta0-preview',
    '/ai-arman/chat/messages',
    '/auth/login',
  ])('does not expose internal route %s', (path) => {
    expect(
      evaluateCustomerGatewayBoundary({ method: 'GET', path }),
    ).toEqual({ allowed: false, status: 404, reason: 'route_not_exposed' });
  });

  it('requires the exact method for each exposed route', () => {
    expect(
      evaluateCustomerGatewayBoundary({
        method: 'GET',
        path: '/ai-arman/customer/identity/start',
      }),
    ).toEqual({ allowed: false, status: 405, reason: 'method_not_allowed' });
  });

  it('requires Harmoniq origin on stateful browser requests', () => {
    expect(
      evaluateCustomerGatewayBoundary({
        method: 'POST',
        path: '/ai-arman/customer/chat/messages',
        origin: 'https://evil.example',
      }),
    ).toEqual({ allowed: false, status: 403, reason: 'origin_not_allowed' });
    expect(
      evaluateCustomerGatewayBoundary({
        method: 'POST',
        path: '/ai-arman/customer/chat/messages',
      }),
    ).toEqual({ allowed: false, status: 403, reason: 'origin_not_allowed' });
  });

  it('accepts both canonical Harmoniq origins', () => {
    for (const origin of ['https://harmoniq.se', 'https://www.harmoniq.se']) {
      expect(
        evaluateCustomerGatewayBoundary({
          method: 'POST',
          path: '/ai-arman/customer/identity/verify?x=1',
          origin,
        }),
      ).toEqual({ allowed: true });
    }
  });
});
