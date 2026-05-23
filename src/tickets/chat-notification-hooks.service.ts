import { Injectable } from '@nestjs/common';
import {
  CUSTOMER_CHAT_EVENT_TYPES,
  CustomerChatEventPayload,
} from './customer-chat-events';

@Injectable()
export class ChatNotificationHooksService {
  handle(event: CustomerChatEventPayload) {
    this.onEventPublished(event);

    switch (event.eventType) {
      case CUSTOMER_CHAT_EVENT_TYPES.ConversationEscalated:
        return this.onConversationEscalated(event);
      case CUSTOMER_CHAT_EVENT_TYPES.HumanReplyCreated:
        return this.onHumanReplyCreated(event);
      case CUSTOMER_CHAT_EVENT_TYPES.ConversationAssigned:
        return this.onConversationAssigned(event);
      case CUSTOMER_CHAT_EVENT_TYPES.StatusChanged:
        return this.onStatusChanged(event);
      case CUSTOMER_CHAT_EVENT_TYPES.ConversationResolved:
        return this.onConversationResolved(event);
      default:
        return undefined;
    }
  }

  onEventPublished(_event: CustomerChatEventPayload) {
    return undefined;
  }

  onConversationEscalated(_event: CustomerChatEventPayload) {
    return undefined;
  }

  onHumanReplyCreated(_event: CustomerChatEventPayload) {
    return undefined;
  }

  onConversationAssigned(_event: CustomerChatEventPayload) {
    return undefined;
  }

  onStatusChanged(_event: CustomerChatEventPayload) {
    return undefined;
  }

  onConversationResolved(_event: CustomerChatEventPayload) {
    return undefined;
  }
}
