import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.config';
import { AiArmanInternalPreviewDiagnosticsController } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.controller';
import { AiArmanInternalPreviewDiagnosticsService } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.service';
import { AiArmanInternalPreviewPageController } from './ai-arman/widget/ai-arman-internal-preview-page.controller';
import { AiArmanInternalPreviewPageService } from './ai-arman/widget/ai-arman-internal-preview-page.service';

@Module({
  imports: [AiArmanModule],
  controllers: [
    AiArmanInternalPreviewDiagnosticsController,
    AiArmanInternalPreviewPageController,
  ],
  providers: [
    AiArmanInternalPreviewDiagnosticsConfig,
    AiArmanInternalPreviewDiagnosticsService,
    AiArmanInternalPreviewPageService,
  ],
})
export class AiArmanCandidateModule {}
