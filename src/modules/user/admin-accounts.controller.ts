import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { AdminAccountsService } from './admin-accounts.service';
import { CreateAdminAccountDto, UpdateAdminAccountDto } from './dto/admin-account.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/admins')
export class AdminAccountsController {
  constructor(private readonly admins: AdminAccountsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(@Body() dto: CreateAdminAccountDto) {
    return this.admins.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminAccountDto,
    @CurrentUser() admin?: JwtAccessPayload,
  ) {
    return this.admins.update(id, dto, admin?.sub);
  }
}
