import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AI_ARMAN_CHAT_CONTRACT_VERSION,
  type AiArmanChatChannel,
  type AiArmanChatRequest,
} from './chat-messages.types';

const MAX_ID_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const CHANNELS: AiArmanChatChannel[] = ['web_widget', 'internal_preview'];

@Injectable()
export class ChatRequestParser {
  parse(candidate: unknown): AiArmanChatRequest {
    const body = asRecord(candidate, 'chat_request_invalid');
    assertAllowedKeys(body, [
      'contractVersion',
      'conversationId',
      'clientMessageId',
      'message',
      'context',
    ]);

    if (body.contractVersion !== AI_ARMAN_CHAT_CONTRACT_VERSION) {
      throw invalid('contractVersion');
    }

    const clientMessageId = parseRequiredString(
      body.clientMessageId,
      'clientMessageId',
      MAX_ID_LENGTH,
    );
    const conversationId = parseOptionalString(
      body.conversationId,
      'conversationId',
      MAX_ID_LENGTH,
    );
    const message = parseMessage(body.message);
    const context = parseContext(body.context);

    return {
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      ...(conversationId ? { conversationId } : {}),
      clientMessageId,
      message,
      ...(context ? { context } : {}),
    };
  }
}

function parseMessage(value: unknown): AiArmanChatRequest['message'] {
  const message = asRecord(value, 'chat_request_invalid:message');
  assertExactKeys(message, ['text']);

  return {
    text: parseRequiredString(message.text, 'message.text', MAX_MESSAGE_LENGTH),
  };
}

function parseContext(
  value: unknown,
): AiArmanChatRequest['context'] | undefined {
  if (value === undefined) return undefined;

  const context = asRecord(value, 'chat_request_invalid:context');
  assertAllowedKeys(context, ['locale', 'channel', 'page']);

  const locale = context.locale;
  if (locale !== undefined && locale !== 'sv-SE') {
    throw invalid('context.locale');
  }

  const channel = parseChannel(context.channel);
  const page = parsePage(context.page);

  return {
    ...(locale ? { locale } : {}),
    ...(channel ? { channel } : {}),
    ...(page ? { page } : {}),
  };
}

function parsePage(
  value: unknown,
): NonNullable<AiArmanChatRequest['context']>['page'] | undefined {
  if (value === undefined) return undefined;

  const page = asRecord(value, 'chat_request_invalid:context.page');
  assertAllowedKeys(page, ['url', 'productId']);

  const url = parseOptionalUrl(page.url, 'context.page.url');
  const productId = parseOptionalString(
    page.productId,
    'context.page.productId',
    MAX_ID_LENGTH,
  );

  return {
    ...(url ? { url } : {}),
    ...(productId ? { productId } : {}),
  };
}

function parseChannel(value: unknown): AiArmanChatChannel | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !CHANNELS.includes(value as AiArmanChatChannel)) {
    throw invalid('context.channel');
  }
  return value as AiArmanChatChannel;
}

function parseOptionalUrl(value: unknown, field: string): string | undefined {
  const parsed = parseOptionalString(value, field, MAX_URL_LENGTH);
  if (!parsed) return undefined;

  let url: URL;
  try {
    url = new URL(parsed);
  } catch {
    throw invalid(field);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw invalid(field);
  }

  return parsed;
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  return parseRequiredString(value, field, maxLength);
}

function parseRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') throw invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw invalid(field);
  }
  return normalized;
}

function asRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(code);
  }
  return value as Record<string, unknown>;
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
) {
  const unknownKey = Object.keys(value).find(
    (key) => !allowedKeys.includes(key),
  );
  if (unknownKey) throw invalid(`unknown_field:${unknownKey}`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
) {
  assertAllowedKeys(value, allowedKeys);
  const missingKey = allowedKeys.find((key) => !(key in value));
  if (missingKey) throw invalid(`missing_field:${missingKey}`);
}

function invalid(field: string) {
  return new BadRequestException(`chat_request_invalid:${field}`);
}
