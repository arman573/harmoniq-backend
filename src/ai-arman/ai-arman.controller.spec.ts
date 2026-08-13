import { BadRequestException } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { UserRole } from '../users/user.entity';
import { AiArmanController } from './ai-arman.controller';
import type { AiArmanService } from './ai-arman.service';
import type { ChatRequestParser } from './chat/chat-request.parser';
import type { ChatPreviewService } from './chat/chat-preview.service';
import type { ProductDiscoveryService } from './discovery/product-discovery.service';
import type { ProductIntelligenceEnrichmentService } from './discovery/product-intelligence-enrichment.service';
import type { AuthenticatedAccountOrderAccessService } from './identity/authenticated-account-order-access.service';
import type { SkincareSpecialistChatOrchestrator } from './skincare/skincare-specialist-chat-orchestrator.service';

function controllerWith(verifyAndBind = jest.fn()) {
  const access = { verifyAndBind } as unknown as AuthenticatedAccountOrderAccessService;
  const controller = new AiArmanController(
    {} as AiArmanService,
    {} as SkincareSpecialistChatOrchestrator,
    {} as ChatRequestParser,
    {} as ChatPreviewService,
    {} as ProductDiscoveryService,
    {} as ProductIntelligenceEnrichmentService,
    access,
  );

  return { controller, verifyAndBind };
}

const USER: User = {
  id: 42,
  name: 'Customer',
  email: 'current@example.com',
  role: UserRole.USER,
};

describe('AiArmanController account-order verification boundary', () => {
  it('passes only the authenticated request user plus conversation and order to the access service', async () => {
    const verifyAndBind = jest.fn().mockResolvedValue({
      ok: true,
      conversationId: 'conversation_123',
      orderId: '90250',
      expiresAt: '2026-08-13T10:15:00.000Z',
    });
    const { controller } = controllerWith(verifyAndBind);

    await expect(
      controller.verifyAuthenticatedAccountOrder(
        { conversationId: 'conversation_123', orderId: '90250' },
        { user: USER } as never,
      ),
    ).resolves.toMatchObject({ ok: true, orderId: '90250' });

    expect(verifyAndBind).toHaveBeenCalledWith({
      user: USER,
      conversationId: 'conversation_123',
      orderId: '90250',
    });
  });

  it('rejects caller-supplied identity or verification fields', () => {
    const { controller, verifyAndBind } = controllerWith();

    expect(() =>
      controller.verifyAuthenticatedAccountOrder(
        {
          conversationId: 'conversation_123',
          orderId: '90250',
          authenticatedSubject: 'attacker@example.com',
        },
        { user: USER } as never,
      ),
    ).toThrow(BadRequestException);

    expect(verifyAndBind).not.toHaveBeenCalled();
  });

  it('rejects malformed conversation and order identifiers', () => {
    const { controller, verifyAndBind } = controllerWith();

    expect(() =>
      controller.verifyAuthenticatedAccountOrder(
        { conversationId: 'bad', orderId: 'other-order' },
        { user: USER } as never,
      ),
    ).toThrow(BadRequestException);

    expect(verifyAndBind).not.toHaveBeenCalled();
  });
});
