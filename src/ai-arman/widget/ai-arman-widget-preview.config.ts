import { Injectable } from '@nestjs/common';

export const AI_ARMAN_WIDGET_PREVIEW_ENABLED_ENV =
  'AI_ARMAN_WIDGET_PREVIEW_ENABLED';

@Injectable()
export class AiArmanWidgetPreviewConfig {
  isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_WIDGET_PREVIEW_ENABLED_ENV] === 'true';
  }
}
