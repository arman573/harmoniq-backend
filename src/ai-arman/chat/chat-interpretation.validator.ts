import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AiArmanIntent,
  AiArmanModelInterpretationCandidate,
  AiArmanProductType,
} from './chat-messages.types';

const INTENTS: AiArmanIntent[] = [
  'product_recommendation',
  'purchased_product_usage',
  'order_status',
  'tracking_status',
  'return_help',
  'claim_help',
  'human_handoff',
  'greeting',
  'unknown',
];

const PRODUCT_TYPES: AiArmanProductType[] = [
  'shampoo',
  'conditioner',
  'hair_mask',
  'leave_in',
];

const MAX_LIST_ITEMS = 20;
const MAX_STRING_LENGTH = 120;

@Injectable()
export class ChatInterpretationValidator {
  parse(candidate: unknown): AiArmanModelInterpretationCandidate {
    const value = asRecord(candidate, 'interpretation_invalid');
    assertExactKeys(value, [
      'schemaVersion',
      'source',
      'locale',
      'primaryIntent',
      'secondaryIntents',
      'confidence',
      'entities',
      'missingFields',
      'requiresIdentity',
      'requiresHumanReview',
    ]);

    if (value.schemaVersion !== 'ai-arman-interpretation-v1') {
      throw invalid('schemaVersion');
    }
    if (value.source !== 'model_candidate') {
      throw invalid('source');
    }
    if (value.locale !== 'sv-SE') {
      throw invalid('locale');
    }

    const primaryIntent = parseIntent(value.primaryIntent, 'primaryIntent');
    const secondaryIntents = parseIntentList(
      value.secondaryIntents,
      'secondaryIntents',
    );
    const confidence = parseConfidence(value.confidence);
    const entities = parseEntities(value.entities);
    const missingFields = parseStringList(value.missingFields, 'missingFields');
    const requiresIdentity = parseBoolean(
      value.requiresIdentity,
      'requiresIdentity',
    );
    const requiresHumanReview = parseBoolean(
      value.requiresHumanReview,
      'requiresHumanReview',
    );

    return {
      schemaVersion: 'ai-arman-interpretation-v1',
      source: 'model_candidate',
      locale: 'sv-SE',
      primaryIntent,
      secondaryIntents,
      confidence,
      entities,
      missingFields,
      requiresIdentity,
      requiresHumanReview,
    };
  }
}

function parseEntities(
  value: unknown,
): AiArmanModelInterpretationCandidate['entities'] {
  const entities = asRecord(value, 'interpretation_invalid:entities');
  assertExactKeys(entities, [
    'requestedProductTypes',
    'needs',
    'exclusions',
    'orderReference',
    'productReferences',
  ]);

  return {
    requestedProductTypes: parseProductTypeList(
      entities.requestedProductTypes,
      'entities.requestedProductTypes',
    ),
    needs: parseStringList(entities.needs, 'entities.needs'),
    exclusions: parseStringList(entities.exclusions, 'entities.exclusions'),
    orderReference: parseNullableString(
      entities.orderReference,
      'entities.orderReference',
    ),
    productReferences: parseStringList(
      entities.productReferences,
      'entities.productReferences',
    ),
  };
}

function parseIntent(value: unknown, field: string): AiArmanIntent {
  if (typeof value !== 'string' || !INTENTS.includes(value as AiArmanIntent)) {
    throw invalid(field);
  }
  return value as AiArmanIntent;
}

function parseIntentList(value: unknown, field: string): AiArmanIntent[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw invalid(field);
  }
  return unique(value.map((item, index) => parseIntent(item, `${field}.${index}`)));
}

function parseProductTypeList(
  value: unknown,
  field: string,
): AiArmanProductType[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw invalid(field);
  }
  return unique(
    value.map((item, index) => {
      if (
        typeof item !== 'string' ||
        !PRODUCT_TYPES.includes(item as AiArmanProductType)
      ) {
        throw invalid(`${field}.${index}`);
      }
      return item as AiArmanProductType;
    }),
  );
}

function parseStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw invalid(field);
  }
  return unique(
    value.map((item, index) => parseRequiredString(item, `${field}.${index}`)),
  );
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return parseRequiredString(value, field);
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_STRING_LENGTH) {
    throw invalid(field);
  }
  return normalized;
}

function parseConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid('confidence');
  }
  if (value < 0 || value > 1) throw invalid('confidence');
  return value;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw invalid(field);
  return value;
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(code);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
) {
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw invalid('unknown_or_missing_fields');
  }
}

function invalid(field: string) {
  return new BadRequestException(`interpretation_invalid:${field}`);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
