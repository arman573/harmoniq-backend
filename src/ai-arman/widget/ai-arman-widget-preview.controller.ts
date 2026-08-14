import {
  Controller,
  Get,
  Header,
  NotFoundException,
} from '@nestjs/common';
import { AiArmanWidgetPreviewConfig } from './ai-arman-widget-preview.config';
import { AiArmanWidgetPreviewService } from './ai-arman-widget-preview.service';

@Controller('ai-arman/widget')
export class AiArmanWidgetPreviewController {
  constructor(
    private readonly config: AiArmanWidgetPreviewConfig,
    private readonly preview: AiArmanWidgetPreviewService,
  ) {}

  @Get('beta0-preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  getPreview(): string {
    if (!this.config.isEnabled()) {
      throw new NotFoundException();
    }
    return this.preview.render();
  }
}
