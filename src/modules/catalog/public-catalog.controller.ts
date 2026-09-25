import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

function parseCoord(lat?: string, lng?: string): { lat: number; lng: number } {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!lat || !lng || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    throw new BadRequestException('lat and lng query params are required');
  }
  return { lat: latNum, lng: lngNum };
}

@Controller('catalog')
export class PublicCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.listCustomerCategories();
  }

  @Get('products')
  products(@Query('lat') lat?: string, @Query('lng') lng?: string, @Query('categoryId') categoryId?: string) {
    const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
    return this.catalog.publicListProducts(latNum, lngNum, categoryId);
  }

  @Get('products/:id')
  product(@Param('id') id: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
    return this.catalog.publicGetProduct(id, latNum, lngNum);
  }

  @Get('restaurants')
  restaurants(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
    return this.catalog.publicListRestaurants(latNum, lngNum);
  }

  // lat/lng are optional here (older clients don't send them); with them the
  // response also says how far away the restaurant is and whether it delivers.
  @Get('restaurants/:id')
  restaurant(@Param('id') id: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.catalog.publicGetRestaurant(id, lat && lng ? parseCoord(lat, lng) : undefined);
  }

  @Get('vendors/:id/listings')
  vendorListings(@Param('id') id: string) {
    return this.catalog.getAdminVendorListings(id);
  }

  @Get('search')
  search(@Query('lat') lat?: string, @Query('lng') lng?: string, @Query('q') q?: string) {
    const { lat: latNum, lng: lngNum } = parseCoord(lat, lng);
    return this.catalog.publicSearch(latNum, lngNum, q ?? '');
  }
}
