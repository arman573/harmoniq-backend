import { Injectable } from '@nestjs/common';
import type {
  AiArmanChatRequest,
  AiArmanChatResponse,
  AiArmanResponseBlock,
} from '../../chat/chat-messages.types';
import { AiArmanCustomerResponseConfig } from './ai-arman-customer-response.config';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_REPLY_LENGTH = 3000;
const MAX_RESPONSE_BYTES = 64_000;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    replyText: { type: 'string', minLength: 1, maxLength: MAX_REPLY_LENGTH },
  },
  required: ['replyText'],
} as const;

const INSTRUCTIONS = [
  'Du är AI Arman på HARMONIQ och formulerar ett naturligt, varmt och kort svar på svenska.',
  'Backend har redan bestämt vad som är sant och vilka strukturerade block som visas för kunden.',
  'Använd endast fakta som finns i backendFacts eller i kundens currentMessage.',
  'Du får aldrig hitta på pris, lager, produktfakta, INCI, orderstatus, tracking, returstatus, återbetalning, kompensation, goodwill eller juridiska besked.',
  'Du får inte fatta beslut, välja verktyg, lova åtgärder eller säga att en write har utförts.',
  'Om fakta är otillräckliga ska du säga det kort och följa backendens fråga eller handoff.',
  'Svara utan HTML, markdownrubriker, intern analys, systemtext eller policytext.',
].join(' ');

@Injectable()
export class AiArmanCustomerResponseService {
  constructor(private readonly config: AiArmanCustomerResponseConfig) {}

  async formulate(
    request: AiArmanChatRequest,
    backendResponse: AiArmanChatResponse,
  ): Promise<AiArmanChatResponse> {
    const config = this.config.read();
    if (!config.activationAllowed) return backendResponse;

    const backendFacts = projectBackendFacts(backendResponse);
    const currentMessage = cleanCustomerText(request.message?.text, 2000);
    if (!currentMessage || backendFacts.length === 0) return backendResponse;

    const input = {
      currentMessage,
      intent: backendResponse.interpretation.primaryIntent,
      backendRoute: backendResponse.decision.route,
      executionStatus: backendResponse.decision.executionStatus,
      backendFacts,
    };

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
          instructions: INSTRUCTIONS,
          input: JSON.stringify(input),
          max_output_tokens: 900,
          text: {
            format: {
              type: 'json_schema',
              name: 'ai_arman_customer_response',
              strict: true,
              schema: OUTPUT_SCHEMA,
            },
          },
        }),
      });

      if (!response.ok) return backendResponse;
      const body = await readBoundedJson(response);
      const outputText = extractOutputText(body);
      if (!outputText) return backendResponse;

      const parsed = JSON.parse(outputText) as unknown;
      const replyText = projectReplyText(parsed);
      if (!replyText) return backendResponse;
      if (!numbersAreGrounded(replyText, JSON.stringify(input))) return backendResponse;

      const retainedBlocks = backendResponse.blocks.filter(
        (block) => block.type !== 'message',
      );

      return {
        ...backendResponse,
        blocks: [
          { type: 'message', text: replyText },
          ...retainedBlocks,
        ],
        safety: {
          ...backendResponse.safety,
          aiModelUsed: true,
          writesExecuted: false,
          productionActionsEnabled: false,
          htmlAcceptedFromModel: false,
        },
      };
    } catch {
      return backendResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function projectBackendFacts(response: AiArmanChatResponse): unknown[] {
  const facts: unknown[] = [];

  for (const block of response.blocks) {
    const projected = projectBlock(block);
    if (projected) facts.push(projected);
  }

  if (response.decision.reasons.length) {
    facts.push({
      type: 'backend_reasons',
      reasons: response.decision.reasons.slice(0, 8).map((value) => cleanCustomerText(value, 240)),
    });
  }

  return facts.slice(0, 24);
}

function projectBlock(block: AiArmanResponseBlock): unknown | null {
  switch (block.type) {
    case 'message':
      return { type: 'message', text: cleanCustomerText(block.text, 1600) };
    case 'question':
      return { type: 'question', text: cleanCustomerText(block.text, 800) };
    case 'safety_notice':
      return { type: 'safety_notice', severity: block.severity, text: cleanCustomerText(block.text, 1000) };
    case 'error_notice':
      return { type: 'error_notice', text: cleanCustomerText(block.text, 1000), retryable: block.retryable };
    case 'order_status_card':
      return { type: 'order_status', status: cleanCustomerText(block.statusLabel, 200), updatedAt: block.updatedAt };
    case 'tracking_card':
      return { type: 'tracking', carrier: cleanCustomerText(block.carrier, 120), status: cleanCustomerText(block.trackingLabel, 240), readAt: block.readAt };
    case 'purchased_product_card':
      return { type: 'purchased_product', title: cleanCustomerText(block.title, 240) };
    case 'product_cards':
      return {
        type: 'product_cards',
        products: block.cards.slice(0, 6).map((card) => ({
          title: cleanCustomerText(card.title, 240),
          price: card.price,
          currency: card.currency,
          stockStatus: card.stockStatus,
          whyItFits: card.whyItFits.slice(0, 5).map((value) => cleanCustomerText(value, 240)),
          limitations: card.limitations.slice(0, 4).map((value) => cleanCustomerText(value, 240)),
          usage: card.usage.slice(0, 4).map((value) => cleanCustomerText(value, 240)),
        })),
      };
    case 'support_handoff':
      return { type: 'support_handoff', status: block.status, reason: cleanCustomerText(block.reason, 300) };
    case 'quick_replies':
      return {
        type: 'quick_replies',
        options: block.options.slice(0, 8).map((option) => cleanCustomerText(option.label, 120)),
      };
    default:
      return null;
  }
}

function cleanCustomerText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email_redacted]')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function projectReplyText(value: unknown): string | null {
  if (!isRecord(value) || Object.keys(value).length !== 1) return null;
  const text = typeof value.replyText === 'string' ? value.replyText.trim() : '';
  if (!text || text.length > MAX_REPLY_LENGTH) return null;
  if (/<\/?[a-z][^>]*>/i.test(text)) return null;
  return text;
}

function numbersAreGrounded(reply: string, source: string): boolean {
  const sourceNumbers = new Set(source.match(/\d+(?:[.,]\d+)?/g) || []);
  const replyNumbers = reply.match(/\d+(?:[.,]\d+)?/g) || [];
  return replyNumbers.every((value) => sourceNumbers.has(value));
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
  if (!isRecord(body) || body.status !== 'completed' || !Array.isArray(body.output)) return null;
  const parts: string[] = [];
  for (const item of body.output) {
    if (!isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('').trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
