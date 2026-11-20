import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import { RevenueConfigService } from './revenue-config.service';
import { SettlementService } from './settlement.service';
import { RiderPayoutService } from './rider-payout.service';
import { NewCustomerDeliveryService } from './new-customer-delivery.service';
import { PricingService } from './pricing.service';
import { CreateRevenueConfigDto } from './dto/create-revenue-config.dto';

class SetRiderPayoutTiersDto {
  // Each entry is { fromKm, toKm | null, amount }; RiderPayoutService checks the ranges join up.
  @IsArray()
  tiers: unknown[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminRevenueController {
  constructor(
    private readonly revenueConfig: RevenueConfigService,
    private readonly settlements: SettlementService,
    private readonly riderPayout: RiderPayoutService,
    private readonly newCustomerDelivery: NewCustomerDeliveryService,
    private readonly pricing: PricingService,
  ) {}

  @Post('revenue-config')
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateRevenueConfigDto) {
    return this.revenueConfig.create(user.sub, dto);
  }

  @Get('revenue-config')
  listAll() {
    return this.revenueConfig.listAll();
  }

  @Get('rider-payout-tiers')
  async listRiderPayoutTiers() {
    return { tiers: await this.riderPayout.listTiers() };
  }

  @Put('rider-payout-tiers')
  async setRiderPayoutTiers(@Body() dto: SetRiderPayoutTiersDto) {
    return { tiers: await this.riderPayout.replaceTiers(dto.tiers) };
  }

  @Get('new-customer-delivery')
  getNewCustomerDelivery() {
    return this.newCustomerDelivery.get();
  }

  @Put('new-customer-delivery')
  setNewCustomerDelivery(@Body() body: unknown) {
    return this.newCustomerDelivery.save(body);
  }

  // Customers with their free deliveries used and left.
  @Get('new-customer-delivery/customers')
  listFreeDeliveryCustomers(@Query('search') search?: string) {
    return this.newCustomerDelivery.listCustomers(search);
  }

  @Put('new-customer-delivery/customers/:customerId')
  setFreeDeliveryExtra(@Param('customerId', ParseUUIDPipe) customerId: string, @Body() body: { extraOrders?: unknown }) {
    return this.newCustomerDelivery.setExtra(customerId, body?.extraOrders);
  }

  // What the customer pays for delivery, by distance. Empty = revenue-config fees.
  @Get('delivery-fee-tiers')
  async listDeliveryFeeTiers() {
    return { tiers: await this.newCustomerDelivery.listFeeTiers() };
  }

  @Put('delivery-fee-tiers')
  async setDeliveryFeeTiers(@Body() dto: SetRiderPayoutTiersDto) {
    return { tiers: await this.newCustomerDelivery.replaceFeeTiers(dto.tiers) };
  }

  // Minimum order amount for free delivery, by distance band.
  // Empty = single global threshold from the revenue_config rule.
  @Get('delivery-free-threshold-tiers')
  async listFreeThresholdTiers() {
    return { tiers: await this.newCustomerDelivery.listFreeThresholdTiers() };
  }

  @Put('delivery-free-threshold-tiers')
  async setFreeThresholdTiers(@Body() body: { tiers: unknown }) {
    const saved = await this.newCustomerDelivery.replaceFreeThresholdTiers(body.tiers ?? []);
    return { tiers: saved };
  }

  // Minimum order by distance band. Empty = revenue_config's single minimum.
  @Get('delivery-min-order-tiers')
  async listMinOrderTiers() {
    return { tiers: await this.pricing.listMinOrderTiers() };
  }

  @Put('delivery-min-order-tiers')
  async setMinOrderTiers(@Body() body: { tiers: unknown }) {
    return { tiers: await this.pricing.replaceMinOrderTiers(body.tiers ?? []) };
  }

  // Outer-zone fee and long-distance rule.
  @Get('pricing-settings')
  getPricingSettings() {
    return this.pricing.getSettings();
  }

  @Put('pricing-settings')
  setPricingSettings(@Body() body: unknown) {
    return this.pricing.saveSettings(body);
  }

  @Get('pricing/preview')
  previewPricing(@Query('distanceKm') distanceKm: string, @Query('subtotal') subtotal: string, @Query('outerZone') outerZone?: string) {
    return this.pricing.preview(Number(distanceKm), Number(subtotal), outerZone === 'true');
  }

  @Get('settlements')
  listSettlements() {
    return this.settlements.listAllForAdmin();
  }
}
