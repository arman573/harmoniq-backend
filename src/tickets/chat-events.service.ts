import { Injectable } from '@nestjs/common';
import { ChatNotificationHooksService } from './chat-notification-hooks.service';
import { CustomerChatEventPayload } from './customer-chat-events';

const BLOCKED_METADATA_KEYS = new Set([
  'intent',
  'metadata',
  'policy',
  'policyDecision',
  'rawIntent',
  'rawPolicy',
]);

@Injectable()
export class ChatEventsService {
  constructor(
    private readonly notificationHooks: ChatNotificationHooksService,
  ) {}

  publish(event: CustomerChatEventPayload) {
    const safeEvent = this.toSafeEvent(event);
    this.notificationHooks.handle(safeEvent);

    return safeEvent;
  }

  publishMany(events: CustomerChatEventPayload[]) {
    return events.map((event) => this.publish(event));
  }

  private toSafeEvent(
    event: CustomerChatEventPayload,
  ): CustomerChatEventPayload {
    const metadata = sanitizeMetadata(event.metadata);

    return {
      eventType: event.eventType,
      conversationId: event.conversationId,
      customerId: event.customerId,
      messageId: event.messageId,
      actorType: event.actorType,
      actorUserId: event.actorUserId ?? null,
      intent: event.intent,
      route: event.route,
      status: event.status,
      previousStatus: event.previousStatus,
      escalationRequired: event.escalationRequired,
      priority: event.priority,
      createdAt: event.createdAt,
      ...(metadata ? { metadata } : {}),
    };
  }
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;

  const safeEntries = Object.entries(metadata)
    .filter(([key]) => !BLOCKED_METADATA_KEYS.has(key))
    .map(([key, value]) => [key, sanitizeMetadataValue(value)])
    .filter(([, value]) => value !== undefined);

  return safeEntries.length ? Object.fromEntries(safeEntries) : undefined;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const safeValues = value
      .map((item) => sanitizeMetadataValue(item))
      .filter((item) => item !== undefined);

    return safeValues.length ? safeValues : undefined;
  }

  if (isRecord(value)) {
    return sanitizeMetadata(value);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
