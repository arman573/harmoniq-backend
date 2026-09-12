import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiArmanCandidateModule } from './ai-arman-candidate.module';
import { resolveHttpPort } from './http-port';

export async function bootstrapAiArmanCandidate(): Promise<void> {
  const app = await NestFactory.create(AiArmanCandidateModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(resolveHttpPort());
}

if (require.main === module) {
  void bootstrapAiArmanCandidate();
}
