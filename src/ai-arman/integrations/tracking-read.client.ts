import { Injectable } from '@nestjs/common';
import { readTrackingReadConfig } from './tracking-read.config';
import type {
  TrackingDeliveryType,
  TrackingReadOrder,
  TrackingReadResult,
} from './tracking-read.types';

const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;
const DEFAULT_TIMEOUT_MS = 1500;
const MAX_RESPONSE_BYTES = 128_000;
const MAX_TEXT_LENGTH = 2_048;

@Injectable()
export class TrackingReadClient {
  async getTracking(orderId: string): Promise<TrackingReadResult> {
    const normalizedOrderId = String(orderId || '').trim();
    if (!ORDER_ID_PATTERN.test(normalizedOrderId)) {
      return { ok: false, error: 'tracking_not_found' };
    }

    const config = readTrackingReadConfig();
    if (!config.activationAllowed || !config.baseUrl) {
      return { ok: false, error: 'tracking_read_unavailable' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());

    try {
      const url = new URL('/api/customer-tracking', `${config.baseUrl}/`);
      url.searchParams.set('orderIds', normalizedOrderId);

      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });

      if (response.status === 404) {
        return { ok: false, error: 'tracking_not_found' };
      }
      if (!response.ok) {
        return { ok: false, error: 'tracking_read_unavailable' };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        return { ok: false, error: 'tracking_read_unavailable' };
      }

      const body = await readBoundedJson(response);
      const tracking = projectTrackingResponse(body, normalizedOrderId);
      if (!tracking) {
        return { ok: false, error: 'tracking_not_found' };
      }
      if (!tracking.available) {
        return { ok: false, error: 'tracking_not_found' };
      }

      return { ok: true, tracking };
    } catch {
      return { ok: false, error: 'tracking_read_unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function projectTrackingResponse(
  body: unknown,
  expectedOrderId: string,
): TrackingReadOrder | null {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.orders)) {
    return null;
  }

  const candidate = body.orders.find(
    (item) =>
      isRecord(item) && normalizeOrderId(item.orderId) === expectedOrderId,
  );
  if (!isRecord(candidate)) return null;

  const deliveryType = readDeliveryType(candidate.deliveryType);
  const available = candidate.available;
  if (!deliveryType || typeof available !== 'boolean') return null;

  const deliveryMethod = readNullableString(candidate.deliveryMethod);
  const carrier = readNullableString(candidate.carrier);
  const shipmentStatus = readNullableString(candidate.shipmentStatus);
  const trackingUrl = readNullableString(candidate.trackingUrl);
  const parcelNo = readNullableString(candidate.parcelNo);
  const message = readNullableString(candidate.message);

  if (
    deliveryMethod === undefined ||
    carrier === undefined ||
    shipmentStatus === undefined ||
    trackingUrl === undefined ||
    parcelNo === undefined ||
    message === undefined
  ) {
    return null;
  }

  return {
    orderId: expectedOrderId,
    deliveryMethod,
    deliveryType,
    carrier,
    shipmentStatus,
    trackingUrl,
    parcelNo,
    available,
    message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOrderId(value: unknown): string | null {
  const normalized =
    typeof value === 'number' && Number.isInteger(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  return ORDER_ID_PATTERN.test(normalized) ? normalized : null;
}

function readDeliveryType(value: unknown): TrackingDeliveryType | null {
  return value === 'schenker' || value === 'pickup' || value === 'other'
    ? value
    : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, 'utf8') > MAX_TEXT_LENGTH) return undefined;
  return normalized;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('response_too_large');
  }

  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('response_too_large');
  }
  return JSON.parse(text);
}

function readTimeout(): number {
  const configured = Number(process.env.AI_ARMAN_TRACKING_READ_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(5000, Math.max(300, configured));
}
