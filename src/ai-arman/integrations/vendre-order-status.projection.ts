import type { VendreOrderDispatchState } from './vendre-order-read.types';

type UnknownRecord = Record<string, unknown>;

export type SafeVendreOrderStatus = {
  orderId: string;
  status: string;
  statusId: number | null;
  createdAt: string;
  shippingDate: string;
  dispatchState: VendreOrderDispatchState;
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
  const status = firstText(order.status_name, order.status, order.status_text);
  const shippingDate = normalizeDateSignal(
    order.shipping_date ?? order.shippingDate,
  );

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
  };
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

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text.slice(0, 256);
  }
  return '';
}

function unwrapRecord(value: unknown): UnknownRecord | null {
  if (!isRecord(value)) return null;
  return isRecord(value.data) ? value.data : value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
