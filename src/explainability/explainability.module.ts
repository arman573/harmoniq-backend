import { Module } from '@nestjs/common';
import { ExplainabilityService } from './explainability.service';

@Module({
  providers: [ExplainabilityService],
  exports: [ExplainabilityService],
})
export class ExplainabilityModule {}
