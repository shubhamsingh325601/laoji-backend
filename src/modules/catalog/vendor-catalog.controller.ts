import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import { UpdateBusinessHoursDto } from './dto/business-hours.dto';
import {
  CreateVendorCustomProductDto,
  UpdateVendorCustomProductDto,
  UpdateVendorProductDto,
  UpsertVendorProductDto,
} from './dto/vendor-product.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductSuggestionDto } from './dto/product-suggestion.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
@Controller()
export class VendorCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('vendors/me')
  upsertProfile(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpsertVendorProfileDto) {
    return this.catalog.upsertVendorProfile(user.sub, dto);
  }

  @Get('vendors/me')
  async myProfile(@CurrentUser() user: JwtAccessPayload) {
    return this.catalog.getVendorByUserId(user.sub);
  }

  @Patch('vendors/me/business-hours')
  async updateBusinessHours(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateBusinessHoursDto) {
    return this.catalog.updateBusinessHours(user.sub, dto);
  }

  @Delete('vendors/me')
  async deleteAccount(@CurrentUser() user: JwtAccessPayload) {
    return this.catalog.deleteVendorAccount(user.sub);
  }

  @Delete('vendor/me')
  async deleteAccountAlt(@CurrentUser() user: JwtAccessPayload) {
    return this.catalog.deleteVendorAccount(user.sub);
  }

  @Get('vendor/catalog/products')
  browseMasterCatalog(@Query('categoryId') categoryId?: string) {
    return this.catalog.listProducts(categoryId);
  }

  @Get('vendor/products')
  async myListings(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listVendorProducts(vendor.id);
  }

  @Post('vendor/products')
  async upsertListing(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpsertVendorProductDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.upsertVendorProduct(vendor.id, dto);
  }

  @Patch('vendor/products/:id')
  async updateListing(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVendorProductDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateVendorProduct(vendor.id, id, dto);
  }

  @Delete('vendor/products/:id')
  async deleteListing(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteVendorProduct(vendor.id, id);
  }

  @Get('vendor/categories')
  listCategories() {
    return this.catalog.listCategoriesFlat();
  }

  @Post('vendor/categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('vendor/categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('vendor/categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Post('vendor/products/custom')
  async createCustomProduct(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateVendorCustomProductDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createVendorCustomProduct(vendor.id, dto);
  }

  @Patch('vendor/products/custom/:productId')
  async updateCustomProduct(
    @CurrentUser() user: JwtAccessPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateVendorCustomProductDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateVendorCustomProduct(vendor.id, productId, dto);
  }

  @Delete('vendor/products/custom/:productId')
  async deleteCustomProduct(@CurrentUser() user: JwtAccessPayload, @Param('productId') productId: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteVendorCustomProduct(vendor.id, productId);
  }

  @Throttle({ productSuggestion: { limit: 5, ttl: 60_000 } })
  @Post('vendor/product-suggestions')
  async submitSuggestion(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateProductSuggestionDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createProductSuggestion(vendor.id, dto);
  }

  @Get('vendor/product-suggestions')
  async myProductSuggestions(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listMyProductSuggestions(vendor.id);
  }
}
