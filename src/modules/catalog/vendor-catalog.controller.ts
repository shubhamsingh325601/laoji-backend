import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpdateVendorLocationDto, UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import { UpdateBusinessHoursDto } from './dto/business-hours.dto';
import {
  CreateVendorCustomProductDto,
  RestockVendorProductDto,
  UpdateVendorCustomProductDto,
  UpdateVendorProductDto,
  UpsertVendorProductDto,
} from './dto/vendor-product.dto';
import { CreateCategoryDto, CreateVendorCategoryDto, UpdateCategoryDto, UpdateVendorCategoryDto } from './dto/category.dto';
import { CreateProductSuggestionDto } from './dto/product-suggestion.dto';
import { CreateCategorySuggestionDto } from './dto/category-suggestion.dto';
import { CreateGroceryProductDto } from './dto/create-grocery-product.dto';
import { productFormFor } from './product-forms';

// A vendor's categories and products belong to its own store. Laoji's
// (admin's) categories and products are templates it copies from: changing
// one in the store changes only the store's copy (see CatalogService).
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

  @Patch('vendors/me/location')
  async updateLocation(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateVendorLocationDto) {
    return this.catalog.updateVendorLocation(user.sub, dto);
  }

  @Delete('vendors/me')
  async deleteAccount(@CurrentUser() user: JwtAccessPayload) {
    return this.catalog.deleteVendorAccount(user.sub);
  }

  @Delete('vendor/me')
  async deleteAccountAlt(@CurrentUser() user: JwtAccessPayload) {
    return this.catalog.deleteVendorAccount(user.sub);
  }

  @Get('vendor/catalog/categories')
  async myCategories(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listVendorCategories(vendor);
  }

  @Post('vendor/catalog/categories')
  async createCategory(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateVendorCategoryDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createVendorCategory(vendor, dto);
  }

  @Patch('vendor/catalog/categories/:id')
  async updateVendorCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVendorCategoryDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.renameVendorCategory(vendor, id, dto.name);
  }

  @Delete('vendor/catalog/categories/:id')
  async deleteVendorCategory(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteVendorCategory(vendor, id);
  }

  @Get('vendor/catalog/product-form')
  async productForm(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return productFormFor(vendor.businessType);
  }

  @Get('vendor/catalog/products')
  async browseMasterCatalog(@CurrentUser() user: JwtAccessPayload, @Query('categoryId') categoryId?: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listVendorCatalogProducts(vendor, categoryId);
  }

  @Get('vendor/products')
  async myListings(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listVendorProducts(vendor.id);
  }

  @Post('vendor/products')
  async upsertListing(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpsertVendorProductDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.upsertVendorProduct(vendor, dto);
  }

  @Post('vendor/products/new')
  async createNewProduct(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateGroceryProductDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createVendorProduct(vendor, dto);
  }

  @Patch('vendor/products/:id')
  async updateListing(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVendorProductDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateVendorProduct(vendor, id, dto);
  }

  @Post('vendor/products/:id/restock')
  async restockListing(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: RestockVendorProductDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.restockVendorProduct(vendor.id, id, dto.qty);
  }

  @Delete('vendor/products/:id')
  async deleteListing(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteVendorProduct(vendor.id, id);
  }

  // Older routes for the same store categories as /vendor/catalog/categories.
  // They used to act on every category, admin's and other stores' included.
  @Get('vendor/categories')
  async listCategories(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listVendorCategories(vendor);
  }

  @Post('vendor/categories')
  async createCategoryFlat(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateCategoryDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createVendorCategory(vendor, { name: dto.name });
  }

  @Patch('vendor/categories/:id')
  async updateCategory(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    if (!dto.name) throw new BadRequestException('Category name is required');
    return this.catalog.renameVendorCategory(vendor, id, dto.name);
  }

  @Delete('vendor/categories/:id')
  async deleteCategory(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.deleteVendorCategory(vendor, id);
  }

  @Post('vendor/products/custom')
  async createCustomProduct(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateVendorCustomProductDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createVendorCustomProduct(vendor, dto);
  }

  @Patch('vendor/products/custom/:productId')
  async updateCustomProduct(
    @CurrentUser() user: JwtAccessPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateVendorCustomProductDto,
  ) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.updateVendorCustomProduct(vendor, productId, dto);
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
    return this.catalog.createProductSuggestion(vendor, dto);
  }

  @Get('vendor/product-suggestions')
  async myProductSuggestions(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listMyProductSuggestions(vendor.id);
  }

  // Shares the product-suggestion rate limit: both guard against suggestion spam.
  @Throttle({ productSuggestion: { limit: 5, ttl: 60_000 } })
  @Post('vendor/category-suggestions')
  async submitCategorySuggestion(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateCategorySuggestionDto) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.createCategorySuggestion(vendor, dto);
  }

  @Get('vendor/category-suggestions')
  async myCategorySuggestions(@CurrentUser() user: JwtAccessPayload) {
    const vendor = await this.catalog.requireVendor(user.sub);
    return this.catalog.listMyCategorySuggestions(vendor.id);
  }
}
