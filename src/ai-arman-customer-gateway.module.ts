import { Module } from '@nestjs/common';
import { AiArmanModule } from './ai-arman/ai-arman.module';
import { AiArmanCustomerController } from './ai-arman/widget/customer/ai-arman-customer.controller';
import { AiArmanCustomerGatewayController } from './ai-arman/widget/customer/ai-arman-customer-gateway.controller';
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
  controllers: [AiArmanCustomerController, AiArmanCustomerGatewayController],
  providers: [
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
export class AiArmanCustomerGatewayModule {}
