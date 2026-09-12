import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AiArmanCustomerGatewayModule } from './ai-arman-customer-gateway.module';
import { evaluateCustomerGatewayBoundary } from './ai-arman/widget/customer/ai-arman-customer-gateway-boundary';
import { resolveHttpPort } from './http-port';

export async function bootstrapAiArmanCustomerGateway(): Promise<void> {
  const app = await NestFactory.create(AiArmanCustomerGatewayModule);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Frame-Options', 'DENY');

    const decision = evaluateCustomerGatewayBoundary({
      method: req.method,
      path: req.originalUrl || req.url,
      origin: req.headers.origin,
    });
    if (!decision.allowed) {
      res.status(decision.status).json({ ok: false, code: decision.reason });
      return;
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(resolveHttpPort());
}

if (require.main === module) {
  void bootstrapAiArmanCustomerGateway();
}
