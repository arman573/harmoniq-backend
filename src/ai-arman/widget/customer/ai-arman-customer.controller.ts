import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChatRequestParser } from '../../chat/chat-request.parser';
import { SkincareSpecialistChatOrchestrator } from '../../skincare/skincare-specialist-chat-orchestrator.service';
import { AiArmanCustomerIdentityService } from './ai-arman-customer-identity.service';
import { AiArmanCustomerResponseService } from './ai-arman-customer-response.service';
import { AiArmanCustomerSessionService } from './ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman-customer-widget.config';
import { AiArmanCustomerWidgetService } from './ai-arman-customer-widget.service';

@Controller('ai-arman/customer')
export class AiArmanCustomerController {
  constructor(
    private readonly config: AiArmanCustomerWidgetConfig,
    private readonly identity: AiArmanCustomerIdentityService,
    private readonly sessions: AiArmanCustomerSessionService,
    private readonly parser: ChatRequestParser,
    private readonly conversations: SkincareSpecialistChatOrchestrator,
    private readonly responses: AiArmanCustomerResponseService,
    private readonly widget: AiArmanCustomerWidgetService,
  ) {}

  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Content-Type-Options', 'nosniff')
  getWidget(): string {
    if (!this.config.isWidgetEnabled()) throw new NotFoundException();
    return this.widget.renderScript();
  }

  @Post('identity/start')
  startIdentity(@Body() body: unknown) {
    const email = isRecord(body) ? body.email : undefined;
    return this.identity.start(email);
  }

  @Post('identity/verify')
  verifyIdentity(@Body() body: unknown) {
    const value = isRecord(body) ? body : {};
    return this.identity.verify({
      challengeId: value.challengeId,
      code: value.code,
    });
  }

  @Post('chat/messages')
  async createMessage(@Body() body: unknown, @Req() req: Request) {
    if (!this.config.isWidgetEnabled() || !this.config.isIdentityEnabled()) {
      throw new NotFoundException();
    }

    const token = bearerToken(req.headers.authorization);
    const session = token ? this.sessions.verify(token) : null;
    if (!session) throw new UnauthorizedException();

    const request = this.parser.parse(body);
    if (request.context?.channel !== 'web_widget') {
      throw new UnauthorizedException();
    }

    const backendResponse = await this.conversations.handleWithShadow(request);
    return this.responses.formulate(request, backendResponse);
  }
}

function bearerToken(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
