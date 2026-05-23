import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerChatRequestDto } from './customer-chat.dto';
import { CustomerChatService } from './customer-chat.service';
import { TicketsService } from './tickets.service';

@UseGuards(AuthGuard('jwt'))
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly customerChatService: CustomerChatService,
  ) {}

  @Get()
  getCustomers() {
    return this.ticketsService.getCustomers();
  }

  @Get(':id')
  getCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getCustomer(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getCustomerProfile(id);
  }

  @Get(':id/recommendations')
  getRecommendations(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.getCustomerRecommendations(id);
  }

  @Post(':id/chat')
  chat(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CustomerChatRequestDto,
  ) {
    return this.customerChatService.handleCustomerChat(id, body);
  }

  @Get(':id/chat/history')
  getChatHistory(@Param('id', ParseIntPipe) id: number) {
    return this.customerChatService.getCustomerChatHistory(id);
  }
}
