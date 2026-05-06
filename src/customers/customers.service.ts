import { Injectable } from '@nestjs/common';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class CustomersService {
  constructor(private readonly ticketsService: TicketsService) {}

  getCustomers() {
    return this.ticketsService.getCustomers();
  }

  getCustomer(id: number) {
    return this.ticketsService.getCustomer(id);
  }

  getProfile(id: number) {
    return this.ticketsService.getCustomerProfile(id);
  }

  getRecommendations(id: number) {
    return this.ticketsService.getCustomerRecommendations(id);
  }
}
