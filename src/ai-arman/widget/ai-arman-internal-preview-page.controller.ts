import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman-internal-preview-diagnostics.config';
import { AiArmanInternalPreviewPageService } from './ai-arman-internal-preview-page.service';

@Controller('ai-arman/internal-preview')
export class AiArmanInternalPreviewPageController {
  constructor(
    private readonly config: AiArmanInternalPreviewDiagnosticsConfig,
    private readonly page: AiArmanInternalPreviewPageService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  getPage(): string {
    if (!this.config.isEnabled()) {
      throw new NotFoundException();
    }
    return this.page.render();
  }
}
