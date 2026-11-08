import { Body, Controller, Get, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { HomeTabService } from './home-tab.service';
import { UpdateHomeTabsDto } from './dto/home-tab.dto';

@UseInterceptors(ResponseCacheInterceptor)
@Controller('home-tabs')
export class PublicHomeTabController {
  constructor(private readonly homeTabs: HomeTabService) {}

  @Get()
  list() {
    return this.homeTabs.listLive();
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/home-tabs')
export class AdminHomeTabController {
  constructor(private readonly homeTabs: HomeTabService) {}

  @Get()
  list() {
    return this.homeTabs.listAll();
  }

  @Put()
  update(@Body() dto: UpdateHomeTabsDto, @CurrentUser() admin?: JwtAccessPayload) {
    return this.homeTabs.update(dto.tabs, admin?.sub);
  }
}
