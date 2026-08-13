import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { User } from '../users/user.entity';
import { AiArmanService } from './ai-arman.service';
import { ChatRequestParser } from './chat/chat-request.parser';
import { ChatPreviewService } from './chat/chat-preview.service';
import type { ChatPreviewRequest } from './chat/chat-preview.types';
import { ProductDiscoveryService } from './discovery/product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import type { ProductIntelligencePreviewRequest } from './discovery/product-intelligence-enrichment.service';
import { AuthenticatedAccountOrderAccessService } from './identity/authenticated-account-order-access.service';
import type { RecommendationCandidate } from './recommendation/recommendation.types';
import { SkincareSpecialistChatOrchestrator } from './skincare/skincare-specialist-chat-orchestrator.service';

type AuthenticatedRequest = Request & { user: User };

@Controller('ai-arman')
export class AiArmanController {
  constructor(
    private readonly aiArmanService: AiArmanService,
    private readonly skincareSpecialistChatOrchestrator: SkincareSpecialistChatOrchestrator,
    private readonly chatRequestParser: ChatRequestParser,
    private readonly chatPreviewService: ChatPreviewService,
    private readonly productDiscoveryService: ProductDiscoveryService,
    private readonly productIntelligenceEnrichmentService: ProductIntelligenceEnrichmentService,
    private readonly authenticatedAccountOrderAccess: AuthenticatedAccountOrderAccessService,
  ) {}

  @Get('foundation')
  getFoundationStatus() {
    return this.aiArmanService.getFoundationStatus();
  }

  @Post('chat/messages')
  createChatMessage(@Body() body: unknown) {
    const request = this.chatRequestParser.parse(body);
    return this.skincareSpecialistChatOrchestrator.handleWithShadow(request);
  }

  @Post('identity/account-order/verify')
  @UseGuards(AuthGuard('jwt'))
  verifyAuthenticatedAccountOrder(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const request = parseAccountOrderVerificationRequest(body);
    return this.authenticatedAccountOrderAccess.verifyAndBind({
      user: req.user,
      conversationId: request.conversationId,
      orderId: request.orderId,
    });
  }

  @Get('products/discover')
  discoverProducts(@Query('q') query: string) {
    return this.productDiscoveryService.discover(query);
  }

  @Post('products/intelligence/preview')
  previewProductIntelligence(@Body() body: ProductIntelligencePreviewRequest) {
    return this.productIntelligenceEnrichmentService.enrich(body);
  }

  @Post('recommendations/preview')
  previewRecommendations(
    @Body() body: { candidates?: RecommendationCandidate[] },
  ) {
    return this.aiArmanService.previewRecommendations(body?.candidates ?? []);
  }

  @Post('chat/preview')
  previewChat(@Body() body: ChatPreviewRequest) {
    return this.chatPreviewService.compose(body);
  }
}

function parseAccountOrderVerificationRequest(body: unknown): {
  conversationId: string;
  orderId: string;
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('account_order_verification_request_invalid');
  }

  const candidate = body as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.some((key) => !['conversationId', 'orderId'].includes(key)) ||
    !keys.includes('conversationId') ||
    !keys.includes('orderId')
  ) {
    throw new BadRequestException('account_order_verification_request_invalid');
  }

  const conversationId =
    typeof candidate.conversationId === 'string'
      ? candidate.conversationId.trim()
      : '';
  const orderId =
    typeof candidate.orderId === 'string' ? candidate.orderId.trim() : '';

  if (
    !/^[A-Za-z0-9_-]{8,128}$/.test(conversationId) ||
    !/^[0-9]{3,12}$/.test(orderId)
  ) {
    throw new BadRequestException('account_order_verification_request_invalid');
  }

  return { conversationId, orderId };
}
