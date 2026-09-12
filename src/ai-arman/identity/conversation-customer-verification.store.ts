import { Injectable } from '@nestjs/common';

const MAX_BINDINGS = 1000;
const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const ORDER_ID_PATTERN = /^[0-9]{3,12}$/;
const VERIFICATION_ID_PATTERN = /^vcv_[0-9a-f-]{36}$/i;

type ConversationCustomerVerificationBinding = {
  conversationId: string;
  userId: number;
  orderId: string;
  verificationId: string;
  expiresAt: string;
};

export type ConversationCustomerVerificationResolution =
  | { ok: true; binding: ConversationCustomerVerificationBinding }
  | {
      ok: false;
      error:
        | 'conversation_verification_not_found'
        | 'conversation_verification_expired'
        | 'conversation_verification_actor_mismatch'
        | 'conversation_verification_order_mismatch';
    };

@Injectable()
export class ConversationCustomerVerificationStore {
  private readonly bindings = new Map<
    string,
    ConversationCustomerVerificationBinding
  >();

  bind(input: ConversationCustomerVerificationBinding, now = new Date()) {
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) {
      throw new Error('conversation_verification_clock_invalid');
    }

    const binding = normalizeBinding(input, nowMs);
    this.pruneExpired(nowMs);
    this.bindings.delete(binding.conversationId);
    this.bindings.set(binding.conversationId, binding);
    this.enforceMaxSize();
    return cloneBinding(binding);
  }

  resolve(
    conversationId: string,
    userId: number,
    orderId: string,
    now = new Date(),
  ): ConversationCustomerVerificationResolution {
    const normalizedConversationId = String(conversationId || '').trim();
    const binding = this.bindings.get(normalizedConversationId);
    if (!binding) {
      return { ok: false, error: 'conversation_verification_not_found' };
    }

    const nowMs = now.getTime();
    const expiresAtMs = Date.parse(binding.expiresAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      this.bindings.delete(normalizedConversationId);
      return { ok: false, error: 'conversation_verification_expired' };
    }

    if (binding.userId !== userId) {
      return { ok: false, error: 'conversation_verification_actor_mismatch' };
    }

    if (binding.orderId !== String(orderId || '').trim()) {
      return { ok: false, error: 'conversation_verification_order_mismatch' };
    }

    return { ok: true, binding: cloneBinding(binding) };
  }

  clear(): void {
    this.bindings.clear();
  }

  private pruneExpired(nowMs: number) {
    for (const [key, binding] of this.bindings) {
      if (Date.parse(binding.expiresAt) <= nowMs) {
        this.bindings.delete(key);
      }
    }
  }

  private enforceMaxSize() {
    while (this.bindings.size > MAX_BINDINGS) {
      const oldestKey = this.bindings.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.bindings.delete(oldestKey);
    }
  }
}

function normalizeBinding(
  input: ConversationCustomerVerificationBinding,
  nowMs: number,
): ConversationCustomerVerificationBinding {
  const conversationId = String(input.conversationId || '').trim();
  const orderId = String(input.orderId || '').trim();
  const verificationId = String(input.verificationId || '').trim();
  const userId = Number(input.userId);
  const expiresAtMs = Date.parse(String(input.expiresAt || ''));

  if (!CONVERSATION_ID_PATTERN.test(conversationId)) {
    throw new Error('conversation_verification_conversation_invalid');
  }
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('conversation_verification_user_invalid');
  }
  if (!ORDER_ID_PATTERN.test(orderId)) {
    throw new Error('conversation_verification_order_invalid');
  }
  if (!VERIFICATION_ID_PATTERN.test(verificationId)) {
    throw new Error('conversation_verification_id_invalid');
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    throw new Error('conversation_verification_expiry_invalid');
  }

  return {
    conversationId,
    userId,
    orderId,
    verificationId,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function cloneBinding(
  binding: ConversationCustomerVerificationBinding,
): ConversationCustomerVerificationBinding {
  return { ...binding };
}
