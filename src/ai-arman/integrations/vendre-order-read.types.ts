export type VendreOrderDispatchState =
  | 'not_dispatched'
  | 'dispatched'
  | 'unknown';

export type SafeVendreOrderRead = {
  orderId: string;
  status: string;
  statusId: number | null;
  createdAt: string;
  shippingDate: string;
  trackingReference: string;
  shipmentReference: string;
  dispatchState: VendreOrderDispatchState;
};

export type VendreOrderReadResult =
  | { ok: true; order: SafeVendreOrderRead }
  | {
      ok: false;
      error: 'order_not_found' | 'order_read_unavailable';
    };
