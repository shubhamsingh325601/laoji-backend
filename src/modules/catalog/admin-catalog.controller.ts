import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { RejectProductSuggestionDto } from './dto/product-suggestion.dto';
import { ApproveCategorySuggestionDto } from './dto/category-suggestion.dto';
import { CreateAdminVendorDto, UpdateAdminVendorDto } from './dto/admin-vendor.dto';
import { CreateAdminVendorItemDto, UpdateAdminVendorItemDto } from './dto/admin-vendor-item.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  listCategories() {
    return this.catalog.listCategoriesTree();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Get('products')
  listProducts() {
    return this.catalog.listProducts();
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.catalog.deleteProduct(id);
  }

  // Minimal — just enough for the Admin Orders list to resolve vendor/
  // restaurant names. Full vendor management (KYC status, hours, etc.) is
  // its own not-yet-built screen, not part of Phase 4's order-list ask.
  @Get('vendors')
  listVendors() {
    return this.catalog.listVendorsAdmin();
  }

  @Get('vendors/:id')
  getVendor(@Param('id') id: string) {
    return this.catalog.getAdminVendor(id);
  }

  @Get('vendors/:id/listings')
  getVendorListings(@Param('id') id: string) {
    return this.catalog.getAdminVendorListings(id);
  }

  @Post('vendors')
  createVendor(@Body() dto: CreateAdminVendorDto) {
    return this.catalog.createAdminVendor(dto);
  }

  @Patch('vendors/:id')
  updateVendor(@Param('id') id: string, @Body() dto: UpdateAdminVendorDto) {
    return this.catalog.updateAdminVendor(id, dto);
  }

  @Delete('vendors/:id')
  deleteVendor(@Param('id') id: string) {
    return this.catalog.deleteAdminVendor(id);
  }

  @Get('vendors/:id/menu-categories')
  getVendorMenuCategories(@Param('id') id: string) {
    return this.catalog.listMenuCategories(id);
  }

  @Post('vendors/:id/items')
  addVendorItem(@Param('id') id: string, @Body() dto: CreateAdminVendorItemDto) {
    return this.catalog.addAdminVendorItem(id, dto);
  }

  @Patch('vendors/:id/items/:itemId')
  updateVendorItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateAdminVendorItemDto,
  ) {
    return this.catalog.updateAdminVendorItem(id, itemId, dto);
  }

  @Delete('vendors/:id/items/:itemId')
  deleteVendorItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.catalog.deleteAdminVendorItem(id, itemId);
  }

  @Get('restaurants')
  listRestaurants() {
    return this.catalog.listRestaurantsBasic();
  }

  @Get('menu-items')
  listMenuItems() {
    return this.catalog.listMenuItemsBasic();
  }

  @Get('product-suggestions')
  listProductSuggestions(@Query('status') status?: 'pending' | 'approved' | 'rejected') {
    return this.catalog.listProductSuggestions(status);
  }

  @Post('product-suggestions/:id/approve')
  approveProductSuggestion(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    return this.catalog.approveProductSuggestion(user.sub, id);
  }

  @Post('product-suggestions/:id/reject')
  rejectProductSuggestion(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: RejectProductSuggestionDto,
  ) {
    return this.catalog.rejectProductSuggestion(user.sub, id, dto.reason);
  }

  @Get('category-suggestions')
  listCategorySuggestions(@Query('status') status?: 'pending' | 'approved' | 'rejected') {
    return this.catalog.listCategorySuggestions(status);
  }

  @Post('category-suggestions/:id/approve')
  approveCategorySuggestion(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: ApproveCategorySuggestionDto,
  ) {
    return this.catalog.approveCategorySuggestion(user.sub, id, dto);
  }

  @Post('category-suggestions/:id/reject')
  rejectCategorySuggestion(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id') id: string,
    @Body() dto: RejectProductSuggestionDto,
  ) {
    return this.catalog.rejectCategorySuggestion(user.sub, id, dto.reason);
  }
}
