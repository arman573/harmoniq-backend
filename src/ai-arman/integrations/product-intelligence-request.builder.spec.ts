import { buildProductIntelligenceBatchRequest } from './product-intelligence-request.builder';
import { PRODUCT_INTELLIGENCE_CONTRACT_VERSION } from './product-intelligence.types';

describe('Product Intelligence request builder', () => {
  it('whitelists outbound fields and redacts obvious customer credentials and PII', () => {
    const request = buildProductIntelligenceBatchRequest(
      'Maila test@example.com eller +46 70 123 45 67. Bearer header.payload.signature token=supersecret',
      [
        {
          productId: ' 1001 ',
          title: ' Hydrating Shampoo ',
          url: 'https://www.harmoniq.se/p/1001?customer=123#reviews',
          apiKey: 'must-not-leave',
          scores: { designation: 99 },
          internalMetadata: { traceId: 'secret-trace' },
        },
      ],
    );

    expect(request).toEqual({
      contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
      customerNeed: {
        message:
          'Maila [email] eller [phone_or_id]. Bearer [REDACTED] token=[REDACTED]',
      },
      products: [
        {
          productId: '1001',
          title: 'Hydrating Shampoo',
          url: 'https://www.harmoniq.se/p/1001',
        },
      ],
    });
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('must-not-leave');
    expect(serialized).not.toContain('designation');
    expect(serialized).not.toContain('secret-trace');
    expect(serialized).not.toContain('test@example.com');
    expect(serialized).not.toContain('header.payload.signature');
    expect(serialized).not.toContain('supersecret');
  });

  it('keeps safe relative paths but strips query strings and fragments', () => {
    expect(
      buildProductIntelligenceBatchRequest('fuktgivande schampo', [
        {
          productId: '1001',
          title: 'Hydrating Shampoo',
          url: '/produkt-1001.html?ref=customer#section',
        },
      ]),
    ).toMatchObject({
      products: [
        {
          productId: '1001',
          title: 'Hydrating Shampoo',
          url: '/produkt-1001.html',
        },
      ],
    });
  });

  it.each([
    ['', [{ productId: '1001', title: 'Hydrating Shampoo' }]],
    ['ok', [{ productId: '1001', title: 'Hydrating Shampoo' }]],
    ['fuktgivande schampo', []],
    [
      'fuktgivande schampo',
      [
        { productId: '1001', title: 'Hydrating Shampoo' },
        { productId: '1001', title: 'Duplicate' },
      ],
    ],
  ])('fails closed for an invalid outbound request', (message, products) => {
    expect(buildProductIntelligenceBatchRequest(message, products)).toBeNull();
  });
});
