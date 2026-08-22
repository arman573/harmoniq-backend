export const CUSTOMER_CHAT_EVENT_TYPES = {
  CustomerMessageCreated: 'customer_chat.customer_message_created',
  AssistantResponseCreated: 'customer_chat.assistant_response_created',
  ConversationEscalated: 'customer_chat.conversation_escalated',
  ConversationAssigned: 'customer_chat.conversation_assigned',
  StatusChanged: 'customer_chat.status_changed',
  InternalNoteCreated: 'customer_chat.internal_note_created',
  HumanReplyCreated: 'customer_chat.human_reply_created',
  ConversationResolved: 'customer_chat.conversation_resolved',
} as const;

export type CustomerChatEventType =
  (typeof CUSTOMER_CHAT_EVENT_TYPES)[keyof typeof CUSTOMER_CHAT_EVENT_TYPES];

export type CustomerChatEventActorType =
  | 'customer'
  | 'assistant'
  | 'admin'
  | 'system';

export type CustomerChatEventPayload = {
  eventType: CustomerChatEventType;
  conversationId: number;
  customerId: number;
  messageId?: number;
  actorType: CustomerChatEventActorType;
  actorUserId?: number | null;
  intent?: string;
  route?: string;
  status?: string;
  previousStatus?: string;
  escalationRequired?: boolean;
  priority?: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
};
