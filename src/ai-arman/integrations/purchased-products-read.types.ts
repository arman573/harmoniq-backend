export type SafePurchasedProduct = {
  productId: string | null;
  articleNumber: string | null;
  title: string;
  quantity: number;
  imageUrl: string | null;
};

export type SafePurchasedProductsRead = {
  orderId: string;
  products: SafePurchasedProduct[];
};
