import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AiArmanAdminReplyDraftConfig } from './ai-arman/admin/admin-reply-draft.config';
import { AiArmanAdminReplyDraftController } from './ai-arman/admin/admin-reply-draft.controller';
import { AiArmanAdminReplyDraftService } from './ai-arman/admin/admin-reply-draft.service';
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
import { AiArmanCustomerSessionService } from './ai-arman/widget/customer/ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman/widget/customer/ai-arman-customer-widget.config';
import { AiArmanCustomerWidgetService } from './ai-arman/widget/customer/ai-arman-customer-widget.service';
import { GmailCustomerEmailOtpSender } from './ai-arman/widget/customer/gmail-customer-email-otp.sender';
import { VendreCustomerDirectoryVerificationProvider } from './ai-arman/widget/customer/vendre-customer-directory-verification.provider';

@Module({
  imports: [AiArmanModule],
  controllers: [
    AiArmanAdminReplyDraftController,
    AiArmanInternalPreviewDiagnosticsController,
    AiArmanInternalPreviewPageController,
    AiArmanCustomerController,
  ],
  providers: [
    AiArmanAdminReplyDraftConfig,
    AiArmanAdminReplyDraftService,
    AiArmanInternalPreviewDiagnosticsConfig,
    AiArmanInternalPreviewDiagnosticsService,
    AiArmanInternalPreviewPageService,
    AiArmanCustomerIdentityService,
    AiArmanCustomerIdentityStore,
    AiArmanCustomerOtpRateLimiter,
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
