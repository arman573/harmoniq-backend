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

  it('removes dangerous invisible characters from customer text', () => {
    const request = buildProductIntelligenceBatchRequest(
      'Jag vill ha\u200B ett milt\u202E schampo',
      [{ productId: '1001', title: 'Hydrating Shampoo' }],
    );

    expect(request?.customerNeed.message).toBe('Jag vill ha  ett milt  schampo');
    expect(request?.customerNeed.message).not.toMatch(/[\u200B\u202E]/);
  });

  it.each([
    {
      label: 'productId over 128 characters',
      product: { productId: 'p'.repeat(129), title: 'Hydrating Shampoo' },
    },
    {
      label: 'title over 300 characters',
      product: { productId: '1001', title: 'T'.repeat(301) },
    },
    {
      label: 'zero-width character in productId',
      product: { productId: '10\u200B01', title: 'Hydrating Shampoo' },
    },
    {
      label: 'bidi override in title',
      product: { productId: '1001', title: 'Hydrating\u202E Shampoo' },
    },
    {
      label: 'control character in title',
      product: { productId: '1001', title: 'Hydrating\u0007 Shampoo' },
    },
  ])('fails closed for $label', ({ product }) => {
    expect(
      buildProductIntelligenceBatchRequest('fuktgivande schampo', [product]),
    ).toBeNull();
  });

  it('drops an overlong optional product URL instead of forwarding it', () => {
    const request = buildProductIntelligenceBatchRequest(
      'fuktgivande schampo',
      [
        {
          productId: '1001',
          title: 'Hydrating Shampoo',
          url: `https://www.harmoniq.se/${'a'.repeat(1100)}`,
        },
      ],
    );

    expect(request).toEqual({
      contractVersion: PRODUCT_INTELLIGENCE_CONTRACT_VERSION,
      customerNeed: { message: 'fuktgivande schampo' },
      products: [{ productId: '1001', title: 'Hydrating Shampoo' }],
    });
  });

  it('fails closed when the minimized serialized request exceeds 32 KiB', () => {
    const products = Array.from({ length: 25 }, (_, index) => ({
      productId: `product-${index}`,
      title: 'T'.repeat(300),
      url: `https://www.harmoniq.se/${'u'.repeat(900)}-${index}`,
    }));

    expect(
      buildProductIntelligenceBatchRequest('M'.repeat(1000), products),
    ).toBeNull();
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
