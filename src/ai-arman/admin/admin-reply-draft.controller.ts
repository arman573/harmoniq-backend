import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';

const ACCESS_TOKEN_ENV = 'AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN';

@Controller('ai-arman/internal/admin')
export class AiArmanAdminReplyDraftController {
  constructor(private readonly drafts: AiArmanAdminReplyDraftService) {}

  @Post('reply-draft')
  async createReplyDraft(@Body() body: unknown, @Req() req: Request) {
    const expected = String(process.env[ACCESS_TOKEN_ENV] || '').trim();
    const provided = bearerToken(req.headers.authorization);

    if (!expected || !provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException();
    }

    if (!isRecord(body)) {
      return { ok: false, code: 'invalid_admin_reply_context' };
    }

    return this.drafts.createDraft({
      caseId: stringValue(body.caseId),
      orderId: stringValue(body.orderId),
      caseType: stringValue(body.caseType),
      status: stringValue(body.status),
      statusLabel: stringValue(body.statusLabel),
      customerName: stringValue(body.customerName),
      messages: Array.isArray(body.messages)
        ? body.messages.filter(isRecord).map((message) => ({
            direction: stringValue(message.direction),
            sender: stringValue(message.sender),
            subject: stringValue(message.subject),
            text: stringValue(message.text),
            date: stringValue(message.date),
          }))
        : [],
    });
  }
}

function bearerToken(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function safeEqual(actual: string, expected: string): boolean {
  const left = createHash('sha256').update(actual, 'utf8').digest();
  const right = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(left, right);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
