import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';
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
import { AiArmanCustomerSessionService } from './ai-arman/widget/customer/ai-arman-customer-session.service';
import { AiArmanCustomerWidgetConfig } from './ai-arman/widget/customer/ai-arman-customer-widget.config';
import { AiArmanCustomerWidgetService } from './ai-arman/widget/customer/ai-arman-customer-widget.service';
import { GmailCustomerEmailOtpSender } from './ai-arman/widget/customer/gmail-customer-email-otp.sender';
import { VendreCustomerDirectoryVerificationProvider } from './ai-arman/widget/customer/vendre-customer-directory-verification.provider';

@Module({
  imports: [AiArmanModule],
  controllers: [
    AiArmanInternalPreviewDiagnosticsController,
    AiArmanInternalPreviewPageController,
    AiArmanCustomerController,
  ],
  providers: [
    AiArmanInternalPreviewDiagnosticsConfig,
    AiArmanInternalPreviewDiagnosticsService,
    AiArmanInternalPreviewPageService,
    AiArmanCustomerIdentityService,
    AiArmanCustomerIdentityStore,
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
