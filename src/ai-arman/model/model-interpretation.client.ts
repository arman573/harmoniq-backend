import { Injectable } from '@nestjs/common';
import type {
  AiArmanBeautyDomain,
  AiArmanIntent,
  AiArmanModelInterpretationCandidate,
  AiArmanProductType,
} from '../chat/chat-messages.types';
import { readAiArmanModelInterpretationConfig } from './model-interpretation.config';
import type {
  AiArmanModelInterpretationInput,
  AiArmanModelInterpretationResult,
} from './model-interpretation.types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_RESPONSE_BYTES = 128_000;
const MAX_CURRENT_MESSAGE_LENGTH = 2_000;
const MAX_PRIOR_MESSAGES = 6;
const MAX_PRIOR_MESSAGE_LENGTH = 1_000;

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
  'cleanser',
  'face_cream',
  'serum',
  'spf',
  'fragrance',
  'foundation',
  'concealer',
  'lipstick',
  'mascara',
  'nail_polish',
  'base_coat',
  'top_coat',
  'nail_treatment',
];

const BEAUTY_DOMAINS: AiArmanBeautyDomain[] = [
  'haircare',
  'skincare',
  'fragrance',
  'makeup',
  'nails',
];

const MODEL_INSTRUCTIONS = [
  'Du tolkar endast kundens svenska fritext till det givna JSON-schemat för AI Arman.',
  'Du får inte välja verktyg, fatta policybeslut, hitta på produktfakta, orderfakta, tracking eller returutfall.',
  'Klassificera avsikt och extrahera endast information som faktiskt uttrycks i texten.',
  'orderReference ska vara null om ett ordernummer inte uttryckligen finns i underlaget.',
  'productReferences får bara innehålla produktnamn eller artikelreferenser som kunden själv nämner.',
  'needs och exclusions ska vara korta normaliserade signaler, inte fria råd eller svar till kunden.',
].join(' ');

const MODEL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    primaryIntent: { type: 'string', enum: INTENTS },
    secondaryIntents: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', enum: INTENTS },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    requestedProductTypes: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', enum: PRODUCT_TYPES },
    },
    needs: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 80 },
    },
    exclusions: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 80 },
    },
    orderReference: { type: ['string', 'null'], maxLength: 12 },
    productReferences: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 120 },
    },
    recommendationDomain: {
      type: ['string', 'null'],
      enum: [...BEAUTY_DOMAINS, null],
    },
  },
  required: [
    'primaryIntent',
    'secondaryIntents',
    'confidence',
    'requestedProductTypes',
    'needs',
    'exclusions',
    'orderReference',
    'productReferences',
    'recommendationDomain',
  ],
} as const;

@Injectable()
export class AiArmanModelInterpretationClient {
  async interpret(
    input: AiArmanModelInterpretationInput,
  ): Promise<AiArmanModelInterpretationResult> {
    const normalizedInput = normalizeInput(input);
    if (!normalizedInput) {
      return { ok: false, error: 'model_interpretation_invalid' };
    }

    const config = readAiArmanModelInterpretationConfig();
    if (!config.activationAllowed || !config.apiKey || !config.model) {
      return { ok: false, error: 'model_interpretation_disabled' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          store: false,
          instructions: MODEL_INSTRUCTIONS,
          input: JSON.stringify(normalizedInput),
          max_output_tokens: 1_200,
          text: {
            format: {
              type: 'json_schema',
              name: 'ai_arman_interpretation',
              description:
                'Strict semantic interpretation of a Harmoniq customer message. Backend policy decides tools and actions separately.',
              strict: true,
              schema: MODEL_OUTPUT_SCHEMA,
            },
          },
        }),
      });

      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'model_interpretation_authentication' };
      }
      if (response.status === 429) {
        return { ok: false, error: 'model_interpretation_quota' };
      }
      if (!response.ok) {
        return { ok: false, error: 'model_interpretation_unavailable' };
      }

      const body = await readBoundedJson(response);
      const outputText = extractOutputText(body);
      const usage = extractUsage(body);
      if (!outputText || !usage) {
        return { ok: false, error: 'model_interpretation_invalid' };
      }

      const parsed = JSON.parse(outputText) as unknown;
      const candidate = projectCandidate(parsed);
      return candidate
        ? { ok: true, candidate, usage }
        : { ok: false, error: 'model_interpretation_invalid' };
    } catch {
      return { ok: false, error: 'model_interpretation_unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeInput(
  input: AiArmanModelInterpretationInput,
): { currentMessage: string; priorMessages: string[] } | null {
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (!text || text.length > MAX_CURRENT_MESSAGE_LENGTH) return null;

  const priorMessages = Array.isArray(input.priorMessages)
    ? input.priorMessages
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(-MAX_PRIOR_MESSAGES)
        .map((value) => value.slice(0, MAX_PRIOR_MESSAGE_LENGTH))
    : [];

  return {
    currentMessage: redactEmail(text),
    priorMessages: priorMessages.map(redactEmail),
  };
}

function redactEmail(value: string): string {
  return value.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    '[email_redacted]',
  );
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

function extractOutputText(body: unknown): string | null {
  if (!isRecord(body) || body.status !== 'completed' || !Array.isArray(body.output)) {
    return null;
  }

  const texts: string[] = [];
  for (const item of body.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (
        isRecord(content) &&
        content.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        texts.push(content.text);
      }
    }
  }

  const joined = texts.join('').trim();
  return joined || null;
}

function extractUsage(
  body: unknown,
): { inputTokens: number; outputTokens: number } | null {
  if (!isRecord(body) || !isRecord(body.usage)) return null;
  const inputTokens = body.usage.input_tokens;
  const outputTokens = body.usage.output_tokens;
  if (
    !Number.isInteger(inputTokens) ||
    !Number.isInteger(outputTokens) ||
    Number(inputTokens) < 0 ||
    Number(outputTokens) < 0
  ) {
    return null;
  }
  return {
    inputTokens: Number(inputTokens),
    outputTokens: Number(outputTokens),
  };
}

function projectCandidate(value: unknown): AiArmanModelInterpretationCandidate | null {
  if (!isRecord(value)) return null;
  if (!hasExactKeys(value, Object.keys(MODEL_OUTPUT_SCHEMA.properties))) return null;

  const primaryIntent = readEnum(value.primaryIntent, INTENTS);
  const secondaryIntents = readEnumArray(value.secondaryIntents, INTENTS, 3);
  const confidence = readConfidence(value.confidence);
  const requestedProductTypes = readEnumArray(
    value.requestedProductTypes,
    PRODUCT_TYPES,
    8,
  );
  const needs = readStringArray(value.needs, 12, 80);
  const exclusions = readStringArray(value.exclusions, 12, 80);
  const orderReference = readOrderReference(value.orderReference);
  const productReferences = readStringArray(value.productReferences, 8, 120);
  const recommendationDomain = readNullableDomain(value.recommendationDomain);

  if (
    !primaryIntent ||
    !secondaryIntents ||
    confidence === null ||
    !requestedProductTypes ||
    !needs ||
    !exclusions ||
    orderReference === undefined ||
    !productReferences ||
    recommendationDomain === undefined
  ) {
    return null;
  }

  const requiresIdentity = [
    'purchased_product_usage',
    'order_status',
    'tracking_status',
    'return_help',
    'claim_help',
  ].includes(primaryIntent);

  const missingFields: string[] = [];
  if (primaryIntent === 'product_recommendation' && requestedProductTypes.length === 0) {
    missingFields.push('requestedProductType');
  }
  if (requiresIdentity && !orderReference) {
    missingFields.push('verifiedOrderIdentity');
  }

  return {
    schemaVersion: 'ai-arman-interpretation-v1',
    source: 'model_candidate',
    locale: 'sv-SE',
    primaryIntent,
    secondaryIntents: unique(secondaryIntents.filter((intent) => intent !== primaryIntent)),
    confidence,
    entities: {
      requestedProductTypes: unique(requestedProductTypes),
      needs: unique(needs),
      exclusions: unique(exclusions),
      orderReference,
      productReferences: unique(productReferences),
      recommendationDomain,
    },
    missingFields,
    requiresIdentity,
    requiresHumanReview: primaryIntent === 'human_handoff',
  };
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function readEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  maxItems: number,
): T[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: T[] = [];
  for (const item of value) {
    const parsed = readEnum(item, allowed);
    if (!parsed) return null;
    result.push(parsed);
  }
  return result;
}

function readStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const normalized = item.trim();
    if (!normalized || normalized.length > maxLength) return null;
    result.push(normalized);
  }
  return result;
}

function readConfidence(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function readOrderReference(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return /^[0-9]{3,12}$/.test(normalized) ? normalized : undefined;
}

function readNullableDomain(
  value: unknown,
): AiArmanBeautyDomain | null | undefined {
  if (value === null) return null;
  const domain = readEnum(value, BEAUTY_DOMAINS);
  return domain ?? undefined;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
