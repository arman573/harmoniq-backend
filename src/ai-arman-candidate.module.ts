import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AiArmanAdminActionService } from './ai-arman/admin/admin-action.service';
import { AiArmanAdminCaseAssistantConfig } from './ai-arman/admin/admin-case-assistant.config';
import { AiArmanAdminCaseAssistantController } from './ai-arman/admin/admin-case-assistant.controller';
import { AiArmanAdminCaseAssistantFastService } from './ai-arman/admin/admin-case-assistant-fast.service';
import { AiArmanAdminCaseAssistantOrchestratorService } from './ai-arman/admin/admin-case-assistant-orchestrator.service';
import { AiArmanAdminCaseAssistantPageService } from './ai-arman/admin/admin-case-assistant-page.service';
import { AiArmanAdminCaseAssistantService } from './ai-arman/admin/admin-case-assistant.service';
import { AiArmanAdminCaseAssistantV2PageService } from './ai-arman/admin/admin-case-assistant-v2-page.service';
import { AiArmanAdminCommandPlannerService } from './ai-arman/admin/admin-command-planner.service';
import { AiArmanAdminLearningStore } from './ai-arman/admin/admin-learning.store';
import { AiArmanAdminReplyDraftConfig } from './ai-arman/admin/admin-reply-draft.config';
import { AiArmanAdminReplyDraftController } from './ai-arman/admin/admin-reply-draft.controller';
import { AiArmanAdminReplyDraftService } from './ai-arman/admin/admin-reply-draft.service';
import { AiArmanAdminToolRegistryService } from './ai-arman/admin/admin-tool-registry.service';
import { AiArmanInternalPreviewDiagnosticsConfig } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.config';
import { AiArmanInternalPreviewDiagnosticsController } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.controller';
import { AiArmanInternalPreviewDiagnosticsService } from './ai-arman/widget/ai-arman-internal-preview-diagnostics.service';
import { AiArmanInternalPreviewPageController } from './ai-arman/widget/ai-arman-internal-preview-page.controller';
import { AiArmanInternalPreviewPageService } from './ai-arman/widget/ai-arman-internal-preview-page.service';
import { AiArmanCustomerController } from './ai-arman/widget/customer/ai-arman-customer.controller';
import { AiArmanCustomerIdentityService } from './ai-arman/widget/customer/ai-arman-customer-identity.service';
import {
  CustomerDirectoryVerificationProvider,
  CustomerEmailOtpSender,
} from './ai-arman/widget/customer/ai-arman-customer-identity.providers';
import { AiArmanCustomerIdentityStore } from './ai-arman/widget/customer/ai-arman-customer-identity.store';
import { AiArmanCustomerOtpRateLimiter } from './ai-arman/widget/customer/ai-arman-customer-otp-rate-limiter';
import { AiArmanCustomerResponseConfig } from './ai-arman/widget/customer/ai-arman-customer-response.config';
import { AiArmanCustomerResponseService } from './ai-arman/widget/customer/ai-arman-customer-response.service';
import { AiArmanCustomerSessionService } from './ai-arman/widget/customer/ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman/widget/customer/ai-arman-customer-widget.config';
import { AiArmanCustomerWidgetService } from './ai-arman/widget/customer/ai-arman-customer-widget.service';
import { GmailCustomerEmailOtpSender } from './ai-arman/widget/customer/gmail-customer-email-otp.sender';
import { VendreCustomerDirectoryVerificationProvider } from './ai-arman/widget/customer/vendre-customer-directory-verification.provider';

@Module({
  imports: [AiArmanModule],
  controllers: [
    AiArmanAdminCaseAssistantController,
    AiArmanAdminReplyDraftController,
    AiArmanInternalPreviewDiagnosticsController,
    AiArmanInternalPreviewPageController,
    AiArmanCustomerController,
  ],
  providers: [
    AiArmanAdminActionService,
    AiArmanAdminCaseAssistantConfig,
    AiArmanAdminCaseAssistantFastService,
    AiArmanAdminCaseAssistantOrchestratorService,
    AiArmanAdminCaseAssistantPageService,
    AiArmanAdminCaseAssistantService,
    AiArmanAdminCaseAssistantV2PageService,
    AiArmanAdminCommandPlannerService,
    AiArmanAdminLearningStore,
    AiArmanAdminToolRegistryService,
    AiArmanAdminReplyDraftConfig,
    AiArmanAdminReplyDraftService,
    AiArmanInternalPreviewDiagnosticsConfig,
    AiArmanInternalPreviewDiagnosticsService,
    AiArmanInternalPreviewPageService,
    AiArmanCustomerIdentityService,
    AiArmanCustomerIdentityStore,
    AiArmanCustomerOtpRateLimiter,
    AiArmanCustomerResponseConfig,
    AiArmanCustomerResponseService,
    AiArmanCustomerSessionService,
    AiArmanCustomerWidgetConfig,
    AiArmanCustomerWidgetService,
    GmailCustomerEmailOtpSender,
    VendreCustomerDirectoryVerificationProvider,
    {
      provide: CustomerEmailOtpSender,
      useExisting: GmailCustomerEmailOtpSender,
    },
    {
      provide: CustomerDirectoryVerificationProvider,
      useExisting: VendreCustomerDirectoryVerificationProvider,
    },
  ],
})
export class AiArmanCandidateModule {}
