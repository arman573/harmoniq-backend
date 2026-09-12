import { Injectable } from '@nestjs/common';
import { readVendreOrderReadConfig } from './vendre-order-read.config';
import { projectVendreOrderStatus } from './vendre-order-status.projection';
import type { VendreOrderReadResult } from './vendre-order-read.types';

const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;
const DEFAULT_TIMEOUT_MS = 1500;
const MAX_RESPONSE_BYTES = 256_000;

@Injectable()
export class VendreOrderReadClient {
  async getOrder(orderId: string): Promise<VendreOrderReadResult> {
    const normalizedOrderId = String(orderId || '').trim();
    if (!ORDER_ID_PATTERN.test(normalizedOrderId)) {
      return { ok: false, error: 'order_not_found' };
    }

    const config = readVendreOrderReadConfig();
    if (!config.activationAllowed || !config.baseUrl || !config.apiKey) {
      return { ok: false, error: 'order_read_unavailable' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());

    try {
      const url = new URL(
        `/API/1/orders/${encodeURIComponent(normalizedOrderId)}`,
        `${config.baseUrl}/`,
      );
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Authorization': config.apiKey,
        },
        redirect: 'error',
        signal: controller.signal,
      });

      if (response.status === 404) {
        return { ok: false, error: 'order_not_found' };
      }
      if (!response.ok) {
        return { ok: false, error: 'order_read_unavailable' };
      }

      const body = await readBoundedJson(response);
      const order = projectVendreOrderStatus(body, normalizedOrderId);
      return order
        ? { ok: true, order }
        : { ok: false, error: 'order_not_found' };
    } catch {
      return { ok: false, error: 'order_read_unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
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
  const configured = Number(process.env.AI_ARMAN_VENDRE_ORDER_READ_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(5000, Math.max(300, configured));
}
