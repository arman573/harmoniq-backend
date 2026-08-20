import { Injectable } from '@nestjs/common';

export const AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV =
  'AI_ARMAN_ADMIN_RESOLVER_ENABLED';

@Injectable()
export class AiArmanAdminCaseResolverConfig {
  read() {
    const enabled =
      String(process.env[AI_ARMAN_ADMIN_RESOLVER_ENABLED_ENV] || '')
        .trim()
        .toLowerCase() === 'true';

    return {
      enabled,
      activationAllowed: enabled,
      reason: enabled
        ? 'admin_case_resolver_allowed'
        : 'admin_case_resolver_disabled',
    } as const;
  }
}
