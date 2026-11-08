import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserService } from './user.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-user.dto';
import { UpdateAddressDto } from './dto/address.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly users: UserService) {}

  @Get()
  list(@Query('role') role?: string, @Query('search') search?: string) {
    return this.users.listUsers(role, search);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.users.getUser(id);
  }

  @Post()
  create(@Body() dto: CreateAdminUserDto) {
    return this.users.createUser(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.users.updateUser(id, dto);
  }

  @Patch(':id/addresses/:addressId')
  updateAddress(
    @Param('id') customerId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.users.updateCustomerAddress(customerId, addressId, dto);
  }

  @Delete(':id/addresses/:addressId')
  deleteAddress(@Param('id') customerId: string, @Param('addressId') addressId: string) {
    return this.users.deleteCustomerAddress(customerId, addressId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.users.deleteUser(id);
  }
}
