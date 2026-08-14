import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';

@Module({
  imports: [AiArmanModule],
})
export class AiArmanCandidateModule {}
