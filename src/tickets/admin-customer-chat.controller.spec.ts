import { CustomerChatConversationStatus } from './customer-chat-conversation.entity';
import { AdminCustomerChatController } from './admin-customer-chat.controller';
import { AdminCustomerChatService } from './admin-customer-chat.service';

describe('AdminCustomerChatController', () => {
  it('exposes the admin inbox endpoint', async () => {
    const service = {
      getInbox: jest.fn(async () => ({ rows: [], count: 0 })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.getInbox({
      status: CustomerChatConversationStatus.Escalated,
    });

    expect(service.getInbox).toHaveBeenCalledWith({
      status: CustomerChatConversationStatus.Escalated,
    });
    expect(result).toEqual({ rows: [], count: 0 });
  });

  it('exposes admin chat metrics through the existing admin controller', async () => {
    const service = {
      getMetrics: jest.fn(async () => ({
        totals: {
          conversations: 1,
          messages: 2,
          escalated: 1,
          humanHandled: 0,
          resolved: 0,
          open: 1,
        },
        rates: {
          escalationRate: 1,
          humanHandledRate: 0,
          resolutionRate: 0,
        },
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.getMetrics();

    expect(service.getMetrics).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totals: {
        conversations: 1,
        messages: 2,
        escalated: 1,
        humanHandled: 0,
        resolved: 0,
        open: 1,
      },
      rates: {
        escalationRate: 1,
        humanHandledRate: 0,
        resolutionRate: 0,
      },
    });
  });

  it('exposes admin chat quality through the existing admin controller', async () => {
    const service = {
      getQuality: jest.fn(async () => ({
        frustration: {
          conversations: 1,
          repeatedFrustration: 0,
          rate: 0.5,
        },
        offTopic: { conversations: 0, rate: 0 },
        unsafe: { conversations: 0, rate: 0 },
        mixedIntent: { conversations: 0, rate: 0 },
        recommendation: { conversations: 1, rate: 0.5 },
        support: { conversations: 0, rate: 0 },
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.getQuality();

    expect(service.getQuality).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      frustration: {
        conversations: 1,
        repeatedFrustration: 0,
        rate: 0.5,
      },
      offTopic: { conversations: 0, rate: 0 },
      unsafe: { conversations: 0, rate: 0 },
      mixedIntent: { conversations: 0, rate: 0 },
      recommendation: { conversations: 1, rate: 0.5 },
      support: { conversations: 0, rate: 0 },
    });
  });

  it('exposes conversation detail retrieval', async () => {
    const service = {
      getConversationDetail: jest.fn(async () => ({
        conversation: { conversationId: 'chat-1' },
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.getConversation('chat-1');

    expect(service.getConversationDetail).toHaveBeenCalledWith('chat-1');
    expect(result).toEqual({
      conversation: { conversationId: 'chat-1' },
    });
  });

  it('exposes assignment updates', async () => {
    const service = {
      assignConversation: jest.fn(async () => ({
        conversationId: 'chat-1',
        assignedTo: 7,
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.assignConversation('chat-1', {
      assignedToUserId: 7,
    });

    expect(service.assignConversation).toHaveBeenCalledWith('chat-1', {
      assignedToUserId: 7,
    });
    expect(result).toEqual({
      conversationId: 'chat-1',
      assignedTo: 7,
    });
  });

  it('exposes controlled status updates', async () => {
    const service = {
      updateConversationStatus: jest.fn(async () => ({
        conversationId: 'chat-1',
        status: CustomerChatConversationStatus.Resolved,
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.updateConversationStatus('chat-1', {
      status: CustomerChatConversationStatus.Resolved,
    });

    expect(service.updateConversationStatus).toHaveBeenCalledWith('chat-1', {
      status: CustomerChatConversationStatus.Resolved,
    });
    expect(result).toEqual({
      conversationId: 'chat-1',
      status: CustomerChatConversationStatus.Resolved,
    });
  });

  it('exposes internal note creation', async () => {
    const service = {
      addInternalNote: jest.fn(async () => ({
        id: 1,
        conversationId: 'chat-1',
        body: 'Follow up',
        authorUserId: 9,
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.addInternalNote(
      'chat-1',
      { body: 'Follow up' },
      { user: { id: 9 } },
    );

    expect(service.addInternalNote).toHaveBeenCalledWith(
      'chat-1',
      { body: 'Follow up' },
      9,
    );
    expect(result).toEqual({
      id: 1,
      conversationId: 'chat-1',
      body: 'Follow up',
      authorUserId: 9,
    });
  });

  it('exposes human replies', async () => {
    const service = {
      sendHumanReply: jest.fn(async () => ({
        conversationId: 'chat-1',
        message: {
          id: 10,
          role: 'human',
          content: 'We are on it.',
          createdByUserId: 9,
          source: 'human',
        },
        humanHandled: true,
      })),
    } as unknown as AdminCustomerChatService;
    const controller = new AdminCustomerChatController(service);

    const result = await controller.sendHumanReply(
      'chat-1',
      { message: 'We are on it.' },
      { user: { id: 9 } },
    );

    expect(service.sendHumanReply).toHaveBeenCalledWith(
      'chat-1',
      { message: 'We are on it.' },
      9,
    );
    expect(result).toEqual({
      conversationId: 'chat-1',
      message: {
        id: 10,
        role: 'human',
        content: 'We are on it.',
        createdByUserId: 9,
        source: 'human',
      },
      humanHandled: true,
    });
  });
});
