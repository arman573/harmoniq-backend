import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AiArmanAdminReplyDraftService } from './admin-reply-draft.service';

const ACCESS_TOKEN_ENV = 'AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN';
const ACCESS_TOKEN_HEADER = 'x-ai-arman-admin-token';

@Controller('ai-arman/internal/admin')
export class AiArmanAdminReplyDraftController {
  constructor(private readonly drafts: AiArmanAdminReplyDraftService) {}

  @Post('reply-draft')
  async createReplyDraft(@Body() body: unknown, @Req() req: Request) {
    const expected = String(process.env[ACCESS_TOKEN_ENV] || '').trim();
    const provided = internalAccessToken(req);

    if (!expected || !provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException();
    }

    if (!isRecord(body)) {
      return { ok: false, code: 'invalid_admin_reply_context' };
    }

    return this.drafts.createDraft({
      caseId: stringValue(body.caseId),
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

function internalAccessToken(req: Request): string | null {
  const header = req.headers[ACCESS_TOKEN_HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }
  return bearerToken(req.headers.authorization);
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
