import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../auth/auth.types';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { addresses } from '../../../drizzle/schema';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

// Not built in Phase 1 (flagged then) — added now as a hard prerequisite
// for Phase 4 checkout, which needs a real deliveryAddressId to exist.
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  @Get()
  list(@CurrentUser() user: JwtAccessPayload) {
    return this.db.select().from(addresses).where(eq(addresses.userId, user.sub));
  }

  @Post()
  async create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.sub));
    }
    const [row] = await this.db
      .insert(addresses)
      .values({
        userId: user.sub,
        label: dto.label,
        lat: dto.lat,
        lng: dto.lng,
        formattedAddress: dto.formattedAddress,
        isDefault: dto.isDefault ?? false,
      })
      .returning();
    return row;
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    await this.requireOwn(user.sub, id);
    if (dto.isDefault) {
      await this.db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.sub));
    }
    const [row] = await this.db.update(addresses).set(dto).where(eq(addresses.id, id)).returning();
    return row;
  }

  @Delete(':id')
  async remove(@CurrentUser() user: JwtAccessPayload, @Param('id') id: string) {
    await this.requireOwn(user.sub, id);
    await this.db.delete(addresses).where(eq(addresses.id, id));
    return { ok: true };
  }

  private async requireOwn(userId: string, id: string) {
    const [row] = await this.db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId))).limit(1);
    if (!row) throw new NotFoundException('Address not found');
    return row;
  }
}
