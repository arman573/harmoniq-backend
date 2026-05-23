import { Injectable } from '@nestjs/common';
import {
  ClaimRequestResult,
  OrderLookupRequest,
  OrderLookupResult,
  ReturnRequestResult,
  ShippingTrackingResult,
  SupportIntegrationCapability,
  SupportIntegrationContext,
  SupportIntegrationResult,
} from './support-integration.types';

const SAFE_PLACEHOLDER_MESSAGE =
  "I can help with order questions, but this store's order lookup is not connected yet. I'll route this to support.";

@Injectable()
export class SupportIntegrationService {
  getCapabilities() {
    return SUPPORT_CAPABILITIES.map((capability) => ({
      capability,
      status: 'not_configured' as const,
    }));
  }

  getCapabilityStatus(capability: SupportIntegrationCapability) {
    return {
      capability,
      status: 'not_configured' as const,
      available: false,
    };
  }

  inferCapability(input: {
    message?: string;
    intentType?: string;
    route?: string;
  }): SupportIntegrationCapability {
    const normalized = normalizeText(input.message ?? '');

    if (
      includesAny(normalized, ['return', 'refund', 'retur', 'aterbetalning'])
    ) {
      return 'return_request';
    }

    if (
      includesAny(normalized, ['wrong product', 'fel produkt', 'wrong item'])
    ) {
      return 'claim_wrong_product';
    }

    if (includesAny(normalized, ['damaged', 'broken', 'skadad', 'trasig'])) {
      return 'claim_damaged_product';
    }

    if (
      includesAny(normalized, ['tracking', 'shipping', 'delivery', 'leverans'])
    ) {
      return 'shipping_tracking';
    }

    if (
      includesAny(normalized, ['order', 'invoice', 'payment', 'bestallning'])
    ) {
      return 'order_lookup';
    }

    return 'human_support_handoff';
  }

  lookupOrder(
    _request: OrderLookupRequest,
    _context?: SupportIntegrationContext,
  ): OrderLookupResult {
    return this.createBaseResult('order_lookup') as OrderLookupResult;
  }

  createPlaceholderResult(
    capability: SupportIntegrationCapability,
    _context?: SupportIntegrationContext,
  ): SupportIntegrationResult {
    switch (capability) {
      case 'return_request':
        return this.createBaseResult('return_request') as ReturnRequestResult;
      case 'claim_wrong_product':
      case 'claim_damaged_product':
        return this.createBaseResult(capability) as ClaimRequestResult;
      case 'shipping_tracking':
        return this.createBaseResult(
          'shipping_tracking',
        ) as ShippingTrackingResult;
      case 'order_lookup':
        return this.createBaseResult('order_lookup') as OrderLookupResult;
      case 'human_support_handoff':
      default:
        return this.createBaseResult('human_support_handoff');
    }
  }

  private createBaseResult<TCapability extends SupportIntegrationCapability>(
    capability: TCapability,
  ) {
    return {
      status: 'not_configured' as const,
      capability,
      handled: false,
      requiresHuman: true,
      missingFields: [],
      safeCustomerMessage: SAFE_PLACEHOLDER_MESSAGE,
      summary: `${capability} integration is not configured.`,
    };
  }
}

const SUPPORT_CAPABILITIES: SupportIntegrationCapability[] = [
  'order_lookup',
  'return_request',
  'claim_wrong_product',
  'claim_damaged_product',
  'shipping_tracking',
  'human_support_handoff',
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
