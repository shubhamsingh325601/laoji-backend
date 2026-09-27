import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BannerService } from './banner.service';
import { BANNER_PLACEMENTS, type BannerPlacement, CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Controller('banners')
export class PublicBannerController {
  constructor(private readonly banners: BannerService) {}

  @Get()
  list(@Query('placement') placement = 'home') {
    if (!(BANNER_PLACEMENTS as readonly string[]).includes(placement)) {
      throw new BadRequestException(`placement must be one of: ${BANNER_PLACEMENTS.join(', ')}`);
    }
    return this.banners.listLive(placement as BannerPlacement);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/banners')
export class AdminBannerController {
  constructor(private readonly banners: BannerService) {}

  @Get()
  listAll() {
    return this.banners.listAllForAdmin();
  }

  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.banners.delete(id);
  }
}
