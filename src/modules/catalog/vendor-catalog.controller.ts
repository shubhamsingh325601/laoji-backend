import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { UpsertVendorProfileDto } from './dto/vendor-profile.dto';
import { UpdateVendorProductDto, UpsertVendorProductDto } from './dto/vendor-product.dto';

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
}
