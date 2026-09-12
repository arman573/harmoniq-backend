import { Body, Controller, Post } from '@nestjs/common';
import { ChatRequestParser } from '../chat/chat-request.parser';
import { AiArmanInternalPreviewDiagnosticsService } from './ai-arman-internal-preview-diagnostics.service';

@Controller('ai-arman/internal-preview')
export class AiArmanInternalPreviewDiagnosticsController {
  constructor(
    private readonly parser: ChatRequestParser,
    private readonly diagnostics: AiArmanInternalPreviewDiagnosticsService,
  ) {}

  @Post('diagnostics')
  inspect(@Body() body: unknown) {
    return this.diagnostics.inspect(this.parser.parse(body));
  }
}
