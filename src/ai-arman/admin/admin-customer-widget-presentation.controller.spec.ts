import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV,
  AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV,
  AiArmanAdminCustomerWidgetPresentationController,
} from './admin-customer-widget-presentation.controller';
import type { AiArmanCustomerWidgetPresentationStore } from '../widget/customer/ai-arman-customer-widget-presentation.store';
import { AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION } from '../widget/customer/ai-arman-customer-widget.presentation';

const TOKEN = 'customer-admin-token-that-is-long-enough-123456789';

function request(token = TOKEN): Request {
  return {
    headers: token ? { 'x-ai-arman-customer-admin-token': token } : {},
  } as unknown as Request;
}

function setup() {
  const store = {
    read: jest.fn(async () => ({
      configured: true,
      source: 'gcs' as const,
      generation: '7',
      presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
    })),
    save: jest.fn(async () => ({
      configured: true,
      source: 'gcs' as const,
      generation: '8',
      presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
      updatedAt: '2026-08-23T20:00:00.000Z',
      updatedBy: 'returns-admin',
    })),
  } as unknown as AiArmanCustomerWidgetPresentationStore;
  return {
    store,
    controller: new AiArmanAdminCustomerWidgetPresentationController(store),
  };
}

describe('AiArmanAdminCustomerWidgetPresentationController', () => {
  const previousEnabled = process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV];
  const previousToken = process.env[AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV];

  beforeEach(() => {
    process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV] = 'true';
    process.env[AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV] = TOKEN;
  });

  afterAll(() => {
    if (previousEnabled === undefined) delete process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV];
    else process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV] = previousEnabled;
    if (previousToken === undefined) delete process.env[AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV];
    else process.env[AI_ARMAN_CUSTOMER_ADMIN_ACCESS_TOKEN_ENV] = previousToken;
  });

  it('fails closed while customer admin is disabled', async () => {
    process.env[AI_ARMAN_CUSTOMER_ADMIN_ENABLED_ENV] = 'false';
    const { controller } = setup();
    await expect(controller.read(request())).rejects.toThrow(NotFoundException);
  });

  it('rejects missing or wrong customer-admin credentials', async () => {
    const { controller } = setup();
    await expect(controller.read(request('wrong-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('requires explicit approval before presentation writes', async () => {
    const { controller } = setup();
    await expect(
      controller.update(
        {
          approved: false,
          expectedGeneration: '7',
          presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
        },
        request(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes only through the bounded presentation store after approval', async () => {
    const { controller, store } = setup();
    await expect(
      controller.update(
        {
          approved: true,
          expectedGeneration: '7',
          presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
        },
        request(),
      ),
    ).resolves.toEqual(expect.objectContaining({ ok: true, writeExecuted: true }));
    expect(store.save).toHaveBeenCalledWith({
      presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
      expectedGeneration: '7',
      updatedBy: 'returns-admin',
    });
  });

  it('surfaces optimistic-concurrency conflicts without reporting a write', async () => {
    const { controller, store } = setup();
    (store.save as jest.Mock).mockRejectedValueOnce(
      new Error('customer_presentation_conflict'),
    );
    await expect(
      controller.update(
        {
          approved: true,
          expectedGeneration: '7',
          presentation: AI_ARMAN_CUSTOMER_WIDGET_DEFAULT_PRESENTATION,
        },
        request(),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
