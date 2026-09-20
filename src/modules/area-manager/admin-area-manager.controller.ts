import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AreaManagerService } from './area-manager.service';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { UpdateAreaManagerDto } from './dto/update-area-manager.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/area-managers')
export class AdminAreaManagerController {
  constructor(private readonly areaManagerService: AreaManagerService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.areaManagerService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.areaManagerService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAreaManagerDto) {
    return this.areaManagerService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAreaManagerDto) {
    return this.areaManagerService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.areaManagerService.delete(id);
  }
}
