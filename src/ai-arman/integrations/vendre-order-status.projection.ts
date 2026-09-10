import type { VendreOrderDispatchState } from './vendre-order-read.types';

type UnknownRecord = Record<string, unknown>;

export type SafeVendreOrderStatus = {
  orderId: string;
  status: string;
  statusId: number | null;
  createdAt: string;
  shippingDate: string;
  dispatchState: VendreOrderDispatchState;
  trackingNumber: string;
  trackingUrl: string;
  shipmentStatus: string;
};

export function projectVendreOrderStatus(
  value: unknown,
  expectedOrderId: string,
): SafeVendreOrderStatus | null {
  const order = unwrapRecord(value);
  if (!order) return null;

  const orderId = String(order.id || '').trim();
  if (orderId !== String(expectedOrderId || '').trim()) return null;

  const statusId = normalizeInteger(order.status_id ?? order.statusId);
  const status = firstText(
    order.status_name,
    order.orders_status_name,
    order.status,
    order.status_text,
  );
  const shippingDate = normalizeDateSignal(
    order.shipping_date ?? order.shippingDate,
  );
  const tracking = normalizeTracking(order);

  return {
    orderId,
    status,
    statusId,
    createdAt: firstText(
      order.date_added,
      order.date_purchased,
      order.created_at,
      order.created,
      order.date,
    ),
    shippingDate,
    dispatchState: classifyDispatch(statusId, status, shippingDate),
    trackingNumber: tracking.trackingNumber,
    trackingUrl: tracking.trackingUrl,
    shipmentStatus: tracking.shipmentStatus,
  };
}

function normalizeTracking(order: UnknownRecord): {
  trackingNumber: string;
  trackingUrl: string;
  shipmentStatus: string;
} {
  const sources = trackingSources(order);
  const trackingUrl = firstSafeUrl(
    ...sources.flatMap(({ value, allowGenericUrl }) => [
      value.trackingUrl,
      value.tracking_url,
      value.trackingURL,
      value.parcelUrl,
      value.parcel_url,
      ...(allowGenericUrl ? [value.url] : []),
    ]),
  );

  const trackingNumber = firstText(
    ...sources.flatMap(({ value }) => [
      value.trackingNumber,
      value.tracking_number,
      value.parcelNo,
      value.parcel_no,
      value.parcelNumber,
      value.parcel_number,
      value.consignmentNumber,
      value.consignment_number,
      value.waybill,
    ]),
    trackingNumberFromUrl(trackingUrl),
  );

  const shipmentStatus = firstText(
    ...sources.flatMap(({ value }) => [
      value.shipmentStatus,
      value.shipment_status,
      value.deliveryStatus,
      value.delivery_status,
      value.trackingStatus,
      value.tracking_status,
    ]),
  );

  return {
    trackingNumber: clampText(trackingNumber, 128),
    trackingUrl,
    shipmentStatus: clampText(shipmentStatus, 256),
  };
}

function trackingSources(order: UnknownRecord): Array<{
  value: UnknownRecord;
  allowGenericUrl: boolean;
}> {
  const values: Array<{ value: UnknownRecord; allowGenericUrl: boolean }> = [
    { value: order, allowGenericUrl: false },
  ];

  for (const key of ['shipment', 'shipping', 'delivery', 'info']) {
    const nested = asRecord(order[key]);
    if (!nested) continue;
    values.push({ value: nested, allowGenericUrl: false });
    const tracking = asRecord(nested.tracking);
    if (tracking) values.push({ value: tracking, allowGenericUrl: true });
  }

  const directTracking = asRecord(order.tracking);
  if (directTracking) values.push({ value: directTracking, allowGenericUrl: true });
  return values;
}

function trackingNumberFromUrl(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    const aliases = new Set([
      'refnumber',
      'trackingnumber',
      'tracking_number',
      'parcelno',
      'parcel_no',
      'consignmentnumber',
      'consignment_number',
      'shipmentid',
      'shipment_id',
    ]);
    for (const [key, candidate] of url.searchParams.entries()) {
      if (!aliases.has(key.toLowerCase())) continue;
      const normalized = candidate.trim();
      if (isPlausibleTrackingNumber(normalized)) return normalized;
    }
  } catch {
    return '';
  }
  return '';
}

function isPlausibleTrackingNumber(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{4,127}$/.test(value);
}

function firstSafeUrl(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text || Buffer.byteLength(text, 'utf8') > 2048) continue;
    try {
      const url = new URL(text);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        return url.toString();
      }
    } catch {
      continue;
    }
  }
  return '';
}

function classifyDispatch(
  statusId: number | null,
  status: string,
  shippingDate: string,
): VendreOrderDispatchState {
  if (shippingDate || statusId === 3) return 'dispatched';
  if ([1, 2].includes(statusId ?? -1)) return 'not_dispatched';

  const normalized = normalizeAscii(status);
  if (/\b(skickad|levererad|utlamnad|uthamtad|shipped|delivered|dispatched)\b/.test(normalized)) {
    return 'dispatched';
  }
  if (/\b(ej skickad|inte skickad|ny order|order mottagen|vantar pa plock|plockas|packas|packing|picking)\b/.test(normalized)) {
    return 'not_dispatched';
  }
  return 'unknown';
}

function normalizeAscii(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDateSignal(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === false || value === 0 || value === '0') return '';
  const normalized = String(value).trim();
  if (!normalized || /^0{4}-0{2}-0{2}/.test(normalized)) return '';
  return normalized.slice(0, 64);
}

function clampText(value: string, maxLength: number): string {
  return String(value || '').slice(0, maxLength);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined || typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text.slice(0, 256);
  }
  return '';
}

function unwrapRecord(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  return isRecord(value.data) ? value.data : value;
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
