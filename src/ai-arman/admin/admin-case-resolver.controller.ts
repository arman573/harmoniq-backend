import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { AiArmanAdminCaseResolverConfig } from './admin-case-resolver.config';
import { AiArmanAdminCaseResolverService } from './admin-case-resolver.service';

@Controller('ai-arman/internal/admin-resolver')
export class AiArmanAdminCaseResolverController {
  constructor(
    private readonly config: AiArmanAdminCaseResolverConfig,
    private readonly resolver: AiArmanAdminCaseResolverService,
  ) {}

  @Post('prepare')
  prepare(@Body() body: unknown) {
    this.assertEnabled();
    return this.resolver.prepare(body);
  }

  @Post('execute')
  execute(@Body() body: unknown) {
    this.assertEnabled();
    return this.resolver.execute(body);
  }

  private assertEnabled() {
    if (!this.config.read().activationAllowed) {
      throw new NotFoundException();
    }
  }
}
