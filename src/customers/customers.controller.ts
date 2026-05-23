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
import { CustomerChatRequestDto } from '../tickets/customer-chat.dto';
import { CustomerChatService } from '../tickets/customer-chat.service';
import { CustomersService } from './customers.service';

@UseGuards(AuthGuard('jwt'))
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customerChatService: CustomerChatService,
  ) {}

  @Get()
  getCustomers() {
    return this.customersService.getCustomers();
  }

  @Get(':id')
  getCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.getCustomer(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.getProfile(id);
  }

  @Get(':id/recommendations')
  getRecommendations(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.getRecommendations(id);
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
