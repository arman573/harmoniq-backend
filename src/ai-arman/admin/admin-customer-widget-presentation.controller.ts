import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Put,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AiArmanCustomerWidgetPresentationStore } from '../widget/customer/ai-arman-customer-widget-presentation.store';

export const AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV =
  'AI_ARMAN_CUSTOMER_ADMIN_ENABLED';
export const AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV =
  'AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN';
const ACCESS_TOKEN_HEADER = 'x-ai-arman-customer-admin-token';

@Controller('ai-arman/internal/customer-presentation')
export class AiArmanAdminCustomerWidgetPresentationController {
  constructor(
    private readonly store: AiArmanCustomerWidgetPresentationStore,
  ) {}

  @Get()
  async read(@Req() req: Request) {
    this.assertEnabledAndAuthorized(req);
    const snapshot = await this.store.read();
    return { ok: true, ...snapshot, writeExecuted: false };
  }

  @Put()
  async update(@Body() body: unknown, @Req() req: Request) {
    this.assertEnabledAndAuthorized(req);
    if (!isRecord(body) || body.approved !== true) {
      throw new BadRequestException({
        ok: false,
        code: 'customer_presentation_explicit_approval_required',
        writeExecuted: false,
      });
    }

    try {
      const snapshot = await this.store.save({
        presentation: body.presentation,
        expectedGeneration: body.expectedGeneration,
        updatedBy: 'returns-admin',
      });
      return { ok: true, ...snapshot, writeExecuted: true };
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'customer_presentation_conflict') {
        throw new ConflictException({
          ok: false,
          code,
          writeExecuted: false,
        });
      }
      if (
        code === 'customer_presentation_invalid' ||
        code === 'customer_presentation_generation_invalid' ||
        code === 'customer_presentation_updated_by_invalid' ||
        code === 'customer_presentation_too_large'
      ) {
        throw new BadRequestException({
          ok: false,
          code,
          writeExecuted: false,
        });
      }
      if (
        code === 'customer_presentation_storage_not_configured' ||
        code === 'customer_presentation_identity_unavailable' ||
        code === 'customer_presentation_write_failed' ||
        code === 'customer_presentation_generation_missing'
      ) {
        throw new ServiceUnavailableException({
          ok: false,
          code,
          writeExecuted: false,
        });
      }
      throw error;
    }
  }

  private assertEnabledAndAuthorized(req: Request) {
    if (process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV] !== 'true') {
      throw new NotFoundException();
    }

    const expected = String(
      process.env[AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV] || '',
    ).trim();
    const provided = internalAccessToken(req);
    if (
      expected.length < 32 ||
      !provided ||
      !safeEqual(provided, expected)
    ) {
      throw new UnauthorizedException();
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
