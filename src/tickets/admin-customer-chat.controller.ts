import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import {
  AdminCustomerChatInboxQueryDto,
  AssignCustomerChatConversationDto,
  CreateCustomerChatHumanReplyDto,
  CreateCustomerChatInternalNoteDto,
  UpdateCustomerChatConversationStatusDto,
} from './admin-customer-chat.dto';
import { AdminCustomerChatService } from './admin-customer-chat.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/customer-chat')
export class AdminCustomerChatController {
  constructor(
    private readonly adminCustomerChatService: AdminCustomerChatService,
  ) {}

  @Get('inbox')
  getInbox(@Query() query: AdminCustomerChatInboxQueryDto) {
    return this.adminCustomerChatService.getInbox(query);
  }

  @Get('metrics')
  getMetrics() {
    return this.adminCustomerChatService.getMetrics();
  }

  @Get('quality')
  getQuality() {
    return this.adminCustomerChatService.getQuality();
  }

  @Get('conversations/:conversationId')
  getConversation(@Param('conversationId') conversationId: string) {
    return this.adminCustomerChatService.getConversationDetail(conversationId);
  }

  @Patch('conversations/:conversationId/assign')
  assignConversation(
    @Param('conversationId') conversationId: string,
    @Body() body: AssignCustomerChatConversationDto,
  ) {
    return this.adminCustomerChatService.assignConversation(
      conversationId,
      body,
    );
  }

  @Patch('conversations/:conversationId/status')
  updateConversationStatus(
    @Param('conversationId') conversationId: string,
    @Body() body: UpdateCustomerChatConversationStatusDto,
  ) {
    return this.adminCustomerChatService.updateConversationStatus(
      conversationId,
      body,
    );
  }

  @Post('conversations/:conversationId/notes')
  addInternalNote(
    @Param('conversationId') conversationId: string,
    @Body() body: CreateCustomerChatInternalNoteDto,
    @Req() req: any,
  ) {
    return this.adminCustomerChatService.addInternalNote(
      conversationId,
      body,
      req.user?.id,
    );
  }

  @Post('conversations/:conversationId/reply')
  sendHumanReply(
    @Param('conversationId') conversationId: string,
    @Body() body: CreateCustomerChatHumanReplyDto,
    @Req() req: any,
  ) {
    return this.adminCustomerChatService.sendHumanReply(
      conversationId,
      body,
      req.user?.id,
    );
  }
}
