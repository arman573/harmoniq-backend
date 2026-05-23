import { CustomerChatService } from './customer-chat.service';
import { CustomersController } from './customers.controller';
import { TicketsService } from './tickets.service';

describe('CustomersController', () => {
  it('exposes customer chat through POST /customers/:id/chat handler', async () => {
    const chatService = {
      handleCustomerChat: jest.fn(async () => ({
        customerId: 1,
        response: { text: 'ok', followUpPrompts: [] },
      })),
    } as unknown as CustomerChatService;
    const controller = new CustomersController(
      {} as TicketsService,
      chatService,
    );

    const result = await controller.chat(1, { message: 'hello' });

    expect(chatService.handleCustomerChat).toHaveBeenCalledWith(1, {
      message: 'hello',
    });
    expect(result).toEqual(
      expect.objectContaining({
        customerId: 1,
      }),
    );
  });

  it('exposes customer chat history retrieval', async () => {
    const chatService = {
      getCustomerChatHistory: jest.fn(async () => ({
        customerId: 1,
        conversations: [],
      })),
    } as unknown as CustomerChatService;
    const controller = new CustomersController(
      {} as TicketsService,
      chatService,
    );

    const result = await controller.getChatHistory(1);

    expect(chatService.getCustomerChatHistory).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      customerId: 1,
      conversations: [],
    });
  });
});
