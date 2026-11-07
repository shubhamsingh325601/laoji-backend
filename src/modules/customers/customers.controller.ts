import { Controller, Get, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.customersService.getCustomersWithStats({
      page: pageNum && pageNum > 0 ? pageNum : undefined,
      limit: limitNum && limitNum > 0 ? limitNum : undefined,
    });
  }
}