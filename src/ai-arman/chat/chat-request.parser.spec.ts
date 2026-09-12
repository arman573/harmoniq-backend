import { BadRequestException } from '@nestjs/common';
import { ChatRequestParser } from './chat-request.parser';
import { AI_ARMAN_CHAT_CONTRACT_VERSION } from './chat-messages.types';

describe('ChatRequestParser', () => {
  const parser = new ChatRequestParser();

  it('parses and trims a valid request', () => {
    expect(
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        conversationId: ' conversation-1 ',
        clientMessageId: ' message-1 ',
        message: { text: ' Jag söker schampo. ' },
        context: {
          locale: 'sv-SE',
          channel: 'web_widget',
          page: {
            url: 'https://www.harmoniq.se/c/har/',
            productId: ' 123 ',
          },
        },
      }),
    ).toEqual({
      contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
      conversationId: 'conversation-1',
      clientMessageId: 'message-1',
      message: { text: 'Jag söker schampo.' },
      context: {
        locale: 'sv-SE',
        channel: 'web_widget',
        page: {
          url: 'https://www.harmoniq.se/c/har/',
          productId: '123',
        },
      },
    });
  });

  it.each([
    'intent',
    'route',
    'toolName',
    'plannedTools',
    'permissions',
    'authorization',
    'identity',
    'price',
    'stock',
    'orderFacts',
    'decision',
    'state',
  ])('rejects browser-owned top-level field %s', (field) => {
    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
        [field]: 'spoofed',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown nested fields', () => {
    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo', html: '<b>Schampo</b>' },
      }),
    ).toThrow('chat_request_invalid:unknown_field:html');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
        context: { customerId: '123' },
      }),
    ).toThrow('chat_request_invalid:unknown_field:customerId');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
        context: { page: { url: 'https://harmoniq.se', stock: 10 } },
      }),
    ).toThrow('chat_request_invalid:unknown_field:stock');
  });

  it('rejects unsupported contract, locale and channel values', () => {
    expect(() =>
      parser.parse({
        contractVersion: 'ai-arman-chat-v2',
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
      }),
    ).toThrow('chat_request_invalid:contractVersion');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
        context: { locale: 'en-US' },
      }),
    ).toThrow('chat_request_invalid:context.locale');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'Schampo' },
        context: { channel: 'admin' },
      }),
    ).toThrow('chat_request_invalid:context.channel');
  });

  it('rejects invalid identifiers and message text', () => {
    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: ' ',
        message: { text: 'Schampo' },
      }),
    ).toThrow('chat_request_invalid:clientMessageId');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'x'.repeat(129),
        message: { text: 'Schampo' },
      }),
    ).toThrow('chat_request_invalid:clientMessageId');

    expect(() =>
      parser.parse({
        contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
        clientMessageId: 'message-1',
        message: { text: 'x'.repeat(2001) },
      }),
    ).toThrow('chat_request_invalid:message.text');
  });

  it('only accepts bounded http and https page URLs', () => {
    for (const url of [
      'javascript:alert(1)',
      'ftp://example.com/product',
      'not a url',
      `https://example.com/${'x'.repeat(2048)}`,
    ]) {
      expect(() =>
        parser.parse({
          contractVersion: AI_ARMAN_CHAT_CONTRACT_VERSION,
          clientMessageId: 'message-1',
          message: { text: 'Schampo' },
          context: { page: { url } },
        }),
      ).toThrow('chat_request_invalid:context.page.url');
    }
  });
});
