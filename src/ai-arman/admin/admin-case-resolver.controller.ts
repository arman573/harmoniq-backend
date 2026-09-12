import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AiArmanAdminCaseResolverConfig } from './admin-case-resolver.config';
import { AiArmanAdminCaseResolverService } from './admin-case-resolver.service';

const RESOLVER_ACCESS_TOKEN_ENV = 'AI_ARMAN_ADMIN_RESOLVER_ACCESS_TOKEN';
const REPLY_DRAFT_ACCESS_TOKEN_ENV = 'AI_ARMAN_ADMIN_REPLY_DRAFT_ACCESS_TOKEN';
const ACCESS_TOKEN_HEADER = 'x-ai-arman-admin-token';

@Controller('ai-arman/internal/admin-resolver')
export class AiArmanAdminCaseResolverController {
  constructor(
    private readonly config: AiArmanAdminCaseResolverConfig,
    private readonly resolver: AiArmanAdminCaseResolverService,
  ) {}

  @Post('prepare')
  prepare(@Body() body: unknown, @Req() req: Request) {
    this.assertEnabledAndAuthorized(req);
    return this.resolver.prepare(body);
  }

  @Post('execute')
  execute(@Body() body: unknown, @Req() req: Request) {
    this.assertEnabledAndAuthorized(req);
    return this.resolver.execute(body);
  }

  private assertEnabledAndAuthorized(req: Request) {
    if (!this.config.read().activationAllowed) {
      throw new NotFoundException();
    }

    const expected = String(
      process.env[RESOLVER_ACCESS_TOKEN_ENV]
        || process.env[REPLY_DRAFT_ACCESS_TOKEN_ENV]
        || '',
    ).trim();
    const provided = internalAccessToken(req);
    if (!expected || !provided || !safeEqual(provided, expected)) {
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
