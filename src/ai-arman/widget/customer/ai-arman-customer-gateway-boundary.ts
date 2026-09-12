export type CustomerGatewayRequest = {
  method?: string;
  path?: string;
  origin?: string;
};

const ALLOWED_ORIGINS = new Set([
  'https://harmoniq.se',
  'https://www.harmoniq.se',
]);

const PUBLIC_ROUTES = new Map<string, Set<string>>([
  ['/health', new Set(['GET'])],
  ['/ai-arman/customer/widget.js', new Set(['GET'])],
  ['/ai-arman/customer/identity/start', new Set(['POST'])],
  ['/ai-arman/customer/identity/verify', new Set(['POST'])],
  ['/ai-arman/customer/chat/messages', new Set(['POST'])],
]);

export type CustomerGatewayBoundaryDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 404 | 403 | 405;
      reason: 'route_not_exposed' | 'method_not_allowed' | 'origin_not_allowed';
    };

export function evaluateCustomerGatewayBoundary(
  input: CustomerGatewayRequest,
): CustomerGatewayBoundaryDecision {
  const method = String(input.method || '').trim().toUpperCase();
  const path = normalizePath(input.path);
  const methods = PUBLIC_ROUTES.get(path);

  if (!methods) {
    return { allowed: false, status: 404, reason: 'route_not_exposed' };
  }
  if (!methods.has(method)) {
    return { allowed: false, status: 405, reason: 'method_not_allowed' };
  }

  if (method !== 'GET') {
    const origin = String(input.origin || '').trim().toLowerCase();
    if (!ALLOWED_ORIGINS.has(origin)) {
      return { allowed: false, status: 403, reason: 'origin_not_allowed' };
    }
  }

  return { allowed: true };
}

function normalizePath(value: string | undefined): string {
  const raw = String(value || '').split('?')[0].trim();
  if (!raw.startsWith('/')) return `/${raw}`;
  return raw || '/';
}
