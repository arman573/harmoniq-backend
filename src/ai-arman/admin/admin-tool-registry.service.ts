import { Injectable } from '@nestjs/common';
import { ProductIntelligenceClient } from '../integrations/product-intelligence.client';
import type { ProductIntelligenceRequestProduct } from '../integrations/product-intelligence.types';
import { TrackingReadClient } from '../integrations/tracking-read.client';
import { VendreOrderReadClient } from '../integrations/vendre-order-read.client';

export type AiArmanAdminReadToolName =
  | 'case.read'
  | 'order.read'
  | 'tracking.read'
  | 'product.intelligence';

export type AiArmanAdminToolDescriptor = {
  name: AiArmanAdminReadToolName;
  access: 'read';
  readOnly: true;
  source: 'returns_module' | 'vendre' | 'nshift_vendre' | 'product_intelligence';
};

export type AiArmanAdminToolResult = {
  name: AiArmanAdminReadToolName;
  ok: boolean;
  readOnly: true;
  source: AiArmanAdminToolDescriptor['source'];
  durationMs: number;
  data?: unknown;
  error?: string;
};

@Injectable()
export class AiArmanAdminToolRegistryService {
  private readonly tracking = new TrackingReadClient();
  private readonly orders = new VendreOrderReadClient();
  private readonly productIntelligence = new ProductIntelligenceClient();

  list(): AiArmanAdminToolDescriptor[] {
    return [
      { name: 'case.read', access: 'read', readOnly: true, source: 'returns_module' },
      { name: 'order.read', access: 'read', readOnly: true, source: 'vendre' },
      { name: 'tracking.read', access: 'read', readOnly: true, source: 'nshift_vendre' },
      {
        name: 'product.intelligence',
        access: 'read',
        readOnly: true,
        source: 'product_intelligence',
      },
    ];
  }

  async readCase(data: unknown): Promise<AiArmanAdminToolResult> {
    return {
      name: 'case.read',
      ok: true,
      readOnly: true,
      source: 'returns_module',
      durationMs: 0,
      data,
    };
  }

  async readOrder(orderId: string): Promise<AiArmanAdminToolResult> {
    return this.timed('order.read', 'vendre', async () => {
      const result = await this.orders.getOrder(orderId);
      return result.ok
        ? { ok: true as const, data: result.order }
        : { ok: false as const, error: result.error };
    });
  }

  async readTracking(orderId: string): Promise<AiArmanAdminToolResult> {
    return this.timed('tracking.read', 'nshift_vendre', async () => {
      const result = await this.tracking.getTracking(orderId);
      return result.ok
        ? { ok: true as const, data: result.tracking }
        : { ok: false as const, error: result.error };
    });
  }

  async readProductIntelligence(
    message: string,
    products: ProductIntelligenceRequestProduct[],
  ): Promise<AiArmanAdminToolResult> {
    return this.timed('product.intelligence', 'product_intelligence', async () => {
      const result = await this.productIntelligence.evaluate(message, products);
      return result.ok
        ? {
            ok: true as const,
            data: {
              analyses: result.analyses,
              engineVersion: result.engineVersion || null,
              generatedAt: result.generatedAt || null,
            },
          }
        : { ok: false as const, error: result.error || 'product_intelligence_unavailable' };
    });
  }

  private async timed(
    name: Exclude<AiArmanAdminReadToolName, 'case.read'>,
    source: AiArmanAdminToolDescriptor['source'],
    fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
  ): Promise<AiArmanAdminToolResult> {
    const startedAt = Date.now();
    try {
      const result = await fn();
      return result.ok
        ? {
            name,
            ok: true,
            readOnly: true,
            source,
            durationMs: Date.now() - startedAt,
            data: result.data,
          }
        : {
            name,
            ok: false,
            readOnly: true,
            source,
            durationMs: Date.now() - startedAt,
            error: result.error,
          };
    } catch {
      return {
        name,
        ok: false,
        readOnly: true,
        source,
        durationMs: Date.now() - startedAt,
        error: `${name.replace('.', '_')}_unavailable`,
      };
    }
  }
}
