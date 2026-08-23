import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { ChatRequestParser } from '../../chat/chat-request.parser';
import type { SkincareSpecialistChatOrchestrator } from '../../skincare/skincare-specialist-chat-orchestrator.service';
import { AiArmanCustomerController } from './ai-arman-customer.controller';
import type { AiArmanCustomerIdentityService } from './ai-arman-customer-identity.service';
import type { AiArmanCustomerResponseService } from './ai-arman-customer-response.service';
import type { AiArmanCustomerSessionService } from './ai-arman-customer-session.service';
import type { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';
import type { AiArmanCustomerWidgetPresentationStore } from './ai-arman-customer-widget-presentation.store';
import { AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION } from './ai-arman-customer-widget.presentation';
import { AiArmanCustomerWidgetService } from './ai-arman-customer-widget.service';

const requestBody = {
  contractVersion: 'ai-arman-chat-v1',
  clientMessageId: 'customer-controller-test-1',
  message: { text: 'Hej' },
  context: { locale: 'sv-SE', channel: 'web_widget' },
} as const;

function setup(options: {
  widgetEnabled?: boolean;
  identityEnabled?: boolean;
  validSession?: boolean;
  channel?: 'web_widget' | 'internal_preview';
} = {}) {
  const config = {
    isWidgetEnabled: jest.fn(() => options.widgetEnabled ?? true),
    isIdentityEnabled: jest.fn(() => options.identityEnabled ?? true),
  } as unknown as AiArmanCustomerWidgetConfig;
  const identity = {
    start: jest.fn(async () => ({ ok: true })),
    verify: jest.fn(async () => ({ ok: true })),
  } as unknown as AiArmanCustomerIdentityService;
  const sessions = {
    verify: jest.fn(() =>
      options.validSession === false
        ? null
        : { v: 2 as const, sub: 'kund@example.se', exp: Date.now() + 60_000 },
    ),
  } as unknown as AiArmanCustomerSessionService;
  const parsed = {
    ...requestBody,
    context: {
      locale: 'sv-SE' as const,
      channel: options.channel ?? 'web_widget',
    },
  };
  const parser = {
    parse: jest.fn(() => parsed),
  } as unknown as ChatRequestParser;
  const backendResponse = {
    contractVersion: 'ai-arman-chat-v1',
    conversationId: 'conversation-customer-test',
    blocks: [{ type: 'message', text: 'Hej från AI Arman' }],
  };
  const conversations = {
    handleWithShadow: jest.fn(async () => backendResponse),
  } as unknown as SkincareSpecialistChatOrchestrator;
  const responses = {
    formulate: jest.fn(async (_request, response) => response),
  } as unknown as AiArmanCustomerResponseService;
  const widget = new AiArmanCustomerWidgetService();
  const presentationStore = {
    readForWidget: jest.fn(async () => AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION),
  } as unknown as AiArmanCustomerWidgetPresentationStore;
  const controller = new AiArmanCustomerController(
    config,
    identity,
    sessions,
    parser,
    conversations,
    responses,
    widget,
    presentationStore,
  );
  return {
    controller,
    sessions,
    parser,
    conversations,
    responses,
    presentationStore,
  };
}

function req(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
  } as unknown as Request;
}

describe('AiArmanCustomerController', () => {
  it('does not expose the widget while the customer widget flag is off', async () => {
    const { controller } = setup({ widgetEnabled: false });
    await expect(controller.getWidget()).rejects.toThrow(NotFoundException);
  });

  it('renders the widget from the bounded presentation store', async () => {
    const { controller, presentationStore } = setup();
    const script = await controller.getWidget();
    expect(presentationStore.readForWidget).toHaveBeenCalledTimes(1);
    expect(script).toContain('Din personliga skönhetsassistent');
  });

  it('rejects chat before an identity session is presented', async () => {
    const { controller, parser, conversations, responses } = setup();
    await expect(
      controller.createMessage(requestBody, req()),
    ).rejects.toThrow(UnauthorizedException);
    expect(parser.parse).not.toHaveBeenCalled();
    expect(conversations.handleWithShadow).not.toHaveBeenCalled();
    expect(responses.formulate).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired identity session', async () => {
    const { controller, parser, conversations, responses } = setup({ validSession: false });
    await expect(
      controller.createMessage(requestBody, req('Bearer invalid-token')),
    ).rejects.toThrow(UnauthorizedException);
    expect(parser.parse).not.toHaveBeenCalled();
    expect(conversations.handleWithShadow).not.toHaveBeenCalled();
    expect(responses.formulate).not.toHaveBeenCalled();
  });

  it('rejects internal preview requests on the customer chat route', async () => {
    const { controller, conversations, responses } = setup({ channel: 'internal_preview' });
    await expect(
      controller.createMessage(requestBody, req('Bearer valid-token')),
    ).rejects.toThrow(UnauthorizedException);
    expect(conversations.handleWithShadow).not.toHaveBeenCalled();
    expect(responses.formulate).not.toHaveBeenCalled();
  });

  it('allows web-widget chat only after a valid identity session', async () => {
    const { controller, sessions, parser, conversations, responses } = setup();
    await expect(
      controller.createMessage(requestBody, req('Bearer valid-token')),
    ).resolves.toEqual(
      expect.objectContaining({ conversationId: 'conversation-customer-test' }),
    );
    expect(sessions.verify).toHaveBeenCalledWith('valid-token');
    expect(parser.parse).toHaveBeenCalledWith(requestBody);
    expect(conversations.handleWithShadow).toHaveBeenCalledTimes(1);
    expect(responses.formulate).toHaveBeenCalledTimes(1);
  });

  it('fails closed when customer identity is not activated', async () => {
    const { controller } = setup({ identityEnabled: false });
    await expect(
      controller.createMessage(requestBody, req('Bearer valid-token')),
    ).rejects.toThrow(NotFoundException);
  });
});
