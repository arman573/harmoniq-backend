import { projectPurchasedProducts } from './purchased-products.projection';

describe('projectPurchasedProducts', () => {
  it('projects only safe purchased-product fields for the expected order', () => {
    expect(
      projectPurchasedProducts(
        {
          id: 90250,
          email_address: 'customer@example.com',
          customer_name: 'Secret Name',
          products: [
            {
              id: 998877,
              product_id: 12345,
              model: 'ABC-123',
              name: 'Test Product',
              quantity: 2,
              image: {
                url: {
                  thumbnail: 'https://cdn.example.test/product.jpg',
                },
              },
              price: 199,
              internal_note: 'do-not-project',
            },
          ],
        },
        '90250',
      ),
    ).toEqual({
      orderId: '90250',
      products: [
        {
          productId: '12345',
          articleNumber: 'ABC-123',
          title: 'Test Product',
          quantity: 2,
          imageUrl: 'https://cdn.example.test/product.jpg',
        },
      ],
    });
  });

  it('does not treat a generic row id as product identity', () => {
    expect(
      projectPurchasedProducts(
        {
          id: 90250,
          products: [
            {
              id: 998877,
              model: 'ABC-123',
              name: 'Test Product',
              quantity: 1,
            },
          ],
        },
        '90250',
      ),
    ).toEqual({
      orderId: '90250',
      products: [
        {
          productId: null,
          articleNumber: 'ABC-123',
          title: 'Test Product',
          quantity: 1,
          imageUrl: null,
        },
      ],
    });
  });

  it('rejects a response for a different order', () => {
    expect(
      projectPurchasedProducts(
        { id: 99999, products: [] },
        '90250',
      ),
    ).toBeNull();
  });

  it('requires a products array', () => {
    expect(projectPurchasedProducts({ id: 90250 }, '90250')).toBeNull();
  });

  it('drops malformed product rows instead of inventing product facts', () => {
    expect(
      projectPurchasedProducts(
        {
          id: 90250,
          products: [
            { product_id: 1, name: '', quantity: 1 },
            { product_id: 2, name: 'Zero qty', quantity: 0 },
            { product_id: 3, name: 'Good', quantity: 1 },
          ],
        },
        '90250',
      ),
    ).toEqual({
      orderId: '90250',
      products: [
        {
          productId: '3',
          articleNumber: null,
          title: 'Good',
          quantity: 1,
          imageUrl: null,
        },
      ],
    });
  });

  it.each([
    'http://cdn.example.test/product.jpg',
    'javascript:alert(1)',
    'https://user:pass@cdn.example.test/product.jpg',
    'not-a-url',
  ])('does not project unsafe image URL %s', (imageUrl) => {
    const result = projectPurchasedProducts(
      {
        id: 90250,
        products: [
          {
            product_id: 123,
            name: 'Test Product',
            quantity: 1,
            image_url: imageUrl,
          },
        ],
      },
      '90250',
    );

    expect(result?.products[0].imageUrl).toBeNull();
  });

  it('caps the projected product count', () => {
    const products = Array.from({ length: 60 }, (_, index) => ({
      product_id: index + 1,
      name: `Product ${index + 1}`,
      quantity: 1,
    }));

    const result = projectPurchasedProducts(
      { id: 90250, products },
      '90250',
    );

    expect(result?.products).toHaveLength(50);
  });
});
