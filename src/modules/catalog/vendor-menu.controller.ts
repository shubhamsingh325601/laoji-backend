import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpdateRestaurantDto } from './dto/restaurant.dto';
import { CreateMenuCategoryDto, CreateMenuItemDto, UpdateMenuCategoryDto, UpdateMenuItemDto } from './dto/menu.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
@Controller('vendor')
export class VendorMenuController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('restaurant')
  async myRestaurant(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.getOrCreateRestaurant(vendor.id);
  }

  @Patch('restaurant')
  async updateRestaurant(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateRestaurantDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateRestaurant(vendor.id, dto);
  }

  @Get('menu/categories')
  async listMenuCategories(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listMenuCategories(vendor.id);
  }

  @Post('menu/categories')
  async createMenuCategory(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateMenuCategoryDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createMenuCategory(vendor.id, dto);
  }

  @Patch('menu/categories/:id')
  async updateMenuCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateMenuCategory(vendor.id, id, dto);
  }

  @Delete('menu/categories/:id')
  async deleteMenuCategory(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteMenuCategory(vendor.id, id);
  }

  @Get('menu/items')
  async listMenuItems(@CurrentUser() user: JwtAccessPayload, @Query('categoryId') categoryId?: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listMenuItems(vendor.id, categoryId);
  }

  @Post('menu/items')
  async createMenuItem(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateMenuItemDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createMenuItem(vendor.id, dto);
  }

  @Patch('menu/items/:id')
  async updateMenuItem(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateMenuItem(vendor.id, id, dto);
  }

  @Delete('menu/items/:id')
  async deleteMenuItem(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteMenuItem(vendor.id, id);
  }
}
