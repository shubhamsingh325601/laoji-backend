import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ServiceAreaService } from './service-area.service';

// What the customer app reads to decide whether an address is deliverable.
@UseInterceptors(ResponseCacheInterceptor)
@Controller('service-areas')
export class PublicServiceAreaController {
  constructor(private readonly areas: ServiceAreaService) {}

  @Get()
  async list() {
    return { areas: await this.areas.list(true) };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/service-areas')
export class AdminServiceAreaController {
  constructor(private readonly areas: ServiceAreaService) {}

  @Get()
  async list() {
    return { areas: await this.areas.list() };
  }

  @Post()
  create(@Body() body: unknown) {
    return this.areas.create(body);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.areas.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.areas.remove(id);
  }

  @Post(':id/apply-to-vendors')
  applyToVendors(@Param('id', ParseUUIDPipe) id: string) {
    return this.areas.applyRadiusToVendors(id);
  }
}
