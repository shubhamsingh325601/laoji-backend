import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { areaManagers } from '../../../drizzle/schema';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { UpdateAreaManagerDto } from './dto/update-area-manager.dto';
import { NotificationService } from '../notification/notification.service';
import { handoverEscalationEmail, HandoverEscalationParams } from '../notification/templates/email/handover-escalation';

@Injectable()
export class AreaManagerService {
  private readonly logger = new Logger(AreaManagerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly notifications: NotificationService,
  ) {}

  async findAll(search?: string) {
    let query = this.db.select().from(areaManagers).orderBy(desc(areaManagers.createdAt));

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      return this.db
        .select()
        .from(areaManagers)
        .where(or(ilike(areaManagers.name, q), ilike(areaManagers.email, q), ilike(areaManagers.phone, q), ilike(areaManagers.pincode, q)))
        .orderBy(desc(areaManagers.createdAt));
    }

    return query;
  }

  async findOne(id: string) {
    const [manager] = await this.db.select().from(areaManagers).where(eq(areaManagers.id, id)).limit(1);
    if (!manager) {
      throw new NotFoundException(`Area manager not found`);
    }
    return manager;
  }

  async create(dto: CreateAreaManagerDto) {
    const email = dto.email.trim().toLowerCase();
    const [existing] = await this.db.select().from(areaManagers).where(eq(areaManagers.email, email)).limit(1);
    if (existing) {
      throw new BadRequestException(`An Area Manager with email ${email} already exists`);
    }

    const [created] = await this.db
      .insert(areaManagers)
      .values({
        name: dto.name.trim(),
        email,
        phone: dto.phone.trim(),
        pincode: dto.pincode ? dto.pincode.trim() : '325601',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      })
      .returning();

    return created;
  }

  async update(id: string, dto: UpdateAreaManagerDto) {
    await this.findOne(id);

    const updateValues: Partial<typeof areaManagers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateValues.name = dto.name.trim();
    if (dto.phone !== undefined) updateValues.phone = dto.phone.trim();
    if (dto.pincode !== undefined) updateValues.pincode = dto.pincode.trim();
    if (dto.isActive !== undefined) updateValues.isActive = dto.isActive;

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const [duplicate] = await this.db
        .select()
        .from(areaManagers)
        .where(eq(areaManagers.email, email))
        .limit(1);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`An Area Manager with email ${email} already exists`);
      }
      updateValues.email = email;
    }

    const [updated] = await this.db
      .update(areaManagers)
      .set(updateValues)
      .where(eq(areaManagers.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.db.delete(areaManagers).where(eq(areaManagers.id, id));
    return { success: true, message: 'Area manager removed successfully' };
  }

  /**
   * Find the designated Area Manager for a given pincode.
   * Defaults to '325601' or any active Area Manager.
   */
  async findManagerForPincode(pincode?: string) {
    const targetPin = pincode ? pincode.trim() : '325601';

    // Try matching specific pincode
    const [manager] = await this.db
      .select()
      .from(areaManagers)
      .where(and(eq(areaManagers.pincode, targetPin), eq(areaManagers.isActive, true)))
      .limit(1);

    if (manager) return manager;

    // Fallback to default '325601' manager
    if (targetPin !== '325601') {
      const [fallback] = await this.db
        .select()
        .from(areaManagers)
        .where(and(eq(areaManagers.pincode, '325601'), eq(areaManagers.isActive, true)))
        .limit(1);
      if (fallback) return fallback;
    }

    // Fallback to any active manager
    const [anyActive] = await this.db
      .select()
      .from(areaManagers)
      .where(eq(areaManagers.isActive, true))
      .limit(1);

    return anyActive || null;
  }

  /**
   * Dispatches escalation email to the Area Manager responsible for this pincode/order.
   */
  async dispatchHandoverEscalation(params: HandoverEscalationParams) {
    const manager = await this.findManagerForPincode(params.pincode);
    if (!manager) {
      this.logger.warn(`No active Area Manager found to receive handover escalation for order ${params.orderCode}`);
      return { sent: false, reason: 'No active Area Manager found' };
    }

    const emailTemplate = handoverEscalationEmail(params);
    this.logger.log(`Dispatching Handover Escalation for Order ${params.orderCode} to Area Manager ${manager.name} (${manager.email})`);
    const result = await this.notifications.sendDirectEmail(manager.email, emailTemplate);

    return {
      sent: result.ok,
      manager: {
        id: manager.id,
        name: manager.name,
        email: manager.email,
        phone: manager.phone,
        pincode: manager.pincode,
      },
    };
  }
}
