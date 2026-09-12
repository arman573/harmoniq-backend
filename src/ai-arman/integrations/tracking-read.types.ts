export type TrackingDeliveryType = 'schenker' | 'pickup' | 'other';

export type TrackingReadOrder = {
  orderId: string;
  deliveryMethod: string | null;
  deliveryType: TrackingDeliveryType;
  carrier: string | null;
  shipmentStatus: string | null;
  trackingUrl: string | null;
  parcelNo: string | null;
  available: boolean;
  message: string | null;
};

export type TrackingReadResult =
  | { ok: true; tracking: TrackingReadOrder }
  | { ok: false; error: 'tracking_not_found' | 'tracking_read_unavailable' };
