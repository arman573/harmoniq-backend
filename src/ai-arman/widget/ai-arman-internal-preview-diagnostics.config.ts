import { Injectable } from '@nestjs/common';

export const AI_ARMAN_INTERNAL_PREVIEW_DIAGNOSTICS_ENABLED_ENV =
  'AI_ARMAN_INTERNAL_PREVIEW_DIAGNOSTICS_ENABLED';

@Injectable()
export class AiArmanInternalPreviewDiagnosticsConfig {
  isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env[AI_ARMAN_INTERNAL_PREVIEW_DIAGNOSTICS_ENABLED_ENV] === 'true';
  }
}
