import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import {
  coupons,
  deliveryPartners,
  foodOrders,
  groceryOrders,
  restaurants,
  settlements,
  vendors,
  wallets,
  walletTransactions,
} from '../../../drizzle/schema';
import { WalletService } from '../wallet/wallet.service';

type OrderType = 'grocery' | 'food';

@Injectable()
export class SettlementService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly wallet: WalletService,
  ) {}

  // Small local identity lookups rather than importing CatalogModule/
  // DeliveryModule here — both of those already import RevenueModule (for
  // config resolution / settlement generation), so importing back would
  // be circular. These are the only two fields either module's own
  // requireVendor/requirePartner equivalents would return that this
  // service actually needs.
  async vendorIdForUser(userId: string): Promise<string> {
    const [row] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    if (!row) throw new NotFoundException('Vendor profile not set up yet');
    return row.id;
  }

  async partnerIdForUser(userId: string): Promise<string> {
    const [row] = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!row) throw new NotFoundException('Delivery partner profile not set up yet');
    return row.id;
  }

  // Reuses the exact hook Phase 5/6 already fire from — DeliveryService's
  // OTP-verified delivered transition — same pattern as Phase 6's COD
  // auto-collect and Phase 7's notification dispatch, not a new one.
  // Vendor keeps subtotal minus platform's cut; the delivery partner keeps
  // the whole delivery fee (same "deliveryFee as earnings" precedent
  // Phase 5's frontend already used before real settlements existed).
  async generateForDeliveredOrder(type: OrderType, orderId: string) {
    const table = type === 'grocery' ? groceryOrders : foodOrders;
    const [order] = await this.db.select().from(table).where(eq(table.id, orderId)).limit(1);
    if (!order) return null;

    const [settlement] = await this.db
      .insert(settlements)
      .values({
        ...(type === 'grocery' ? { groceryOrderId: orderId } : { foodOrderId: orderId }),
        vendorPayout: order.subtotal - order.platformCommission,
        deliveryPayout: order.deliveryFee > 0 ? order.deliveryFee : 15,
        platformShare: order.platformCommission,
        commissionPctSnapshot: order.commissionPct,
      })
      .returning();

    // Confirm or credit affiliate commission from our platform commission into creator's wallet
    if (order.couponCode) {
      await this.confirmAffiliateCommission(order, type, orderId);
    }

    return settlement;
  }

  private async confirmAffiliateCommission(order: any, type: OrderType, orderId: string) {
    try {
      const [coupon] = await this.db
        .select()
        .from(coupons)
        .where(eq(coupons.code, order.couponCode))
        .limit(1);

      if (
        !coupon ||
        !coupon.beneficiaryUserId ||
        coupon.affiliateCommissionValue == null ||
        coupon.affiliateCommissionValue <= 0
      ) {
        return;
      }

      // Calculate affiliate commission (from order subtotal or platform commission)
      let commission = 0;
      if (coupon.affiliateCommissionType === 'order_percentage') {
        commission = Math.round(((order.subtotal * coupon.affiliateCommissionValue) / 100) * 100) / 100;
      } else if (coupon.affiliateCommissionType === 'percentage') {
        commission = Math.round(((order.platformCommission * coupon.affiliateCommissionValue) / 100) * 100) / 100;
      } else {
        commission = Math.min(coupon.affiliateCommissionValue, order.platformCommission);
      }

      if (commission > 0) {
        // Check if there was already a pending transaction recorded for this order
        const [pending] = await this.db
          .select()
          .from(walletTransactions)
          .where(
            and(
              eq(walletTransactions.orderId, orderId),
              eq(walletTransactions.type, 'affiliate_commission'),
              eq(walletTransactions.status, 'pending'),
            ),
          )
          .limit(1);

        if (pending) {
          await this.wallet.confirmCommissionOnDelivery(type, orderId);
        } else {
          // If not recorded yet, credit directly to wallet and create completed transaction
          const wallet = await this.wallet.getOrCreateWallet(coupon.beneficiaryUserId);
          const orderCode = orderId.slice(0, 8).toUpperCase();

          await this.db.insert(walletTransactions).values({
            walletId: wallet.id,
            userId: coupon.beneficiaryUserId,
            amount: commission,
            type: 'affiliate_commission',
            status: 'completed',
            description: `Affiliate referral commission for ${type} order #${orderCode} (Coupon: ${coupon.code})`,
            orderId,
            orderType: type,
            couponCode: coupon.code,
          });

          await this.db
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${commission}`,
              totalEarned: sql`${wallets.totalEarned} + ${commission}`,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id));
        }

        // Increment totalRedemptions on coupon
        await this.db
          .update(coupons)
          .set({ totalRedemptions: sql`${coupons.totalRedemptions} + 1` })
          .where(eq(coupons.id, coupon.id));
      }
    } catch (err) {
      console.error('[SettlementService] Failed to credit affiliate commission on order delivery:', err);
    }
  }

  async listForVendor(vendorId: string) {
    const groceryRows = await this.db.select().from(groceryOrders).where(eq(groceryOrders.vendorId, vendorId));
    const restaurantRows = await this.db.select().from(restaurants).where(eq(restaurants.vendorId, vendorId));
    const foodRows = restaurantRows.length
      ? await this.db.select().from(foodOrders).where(inArray(foodOrders.restaurantId, restaurantRows.map((r) => r.id)))
      : [];

    const groceryIds = groceryRows.map((o) => o.id);
    const foodIds = foodRows.map((o) => o.id);
    if (!groceryIds.length && !foodIds.length) return [];

    const [gSettlements, fSettlements] = await Promise.all([
      groceryIds.length ? this.db.select().from(settlements).where(inArray(settlements.groceryOrderId, groceryIds)) : [],
      foodIds.length ? this.db.select().from(settlements).where(inArray(settlements.foodOrderId, foodIds)) : [],
    ]);

    return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
  }

  async listForPartner(partnerId: string) {
    const groceryRows = await this.db.select().from(groceryOrders).where(eq(groceryOrders.deliveryPartnerId, partnerId));
    const foodRows = await this.db.select().from(foodOrders).where(eq(foodOrders.deliveryPartnerId, partnerId));
    const groceryIds = groceryRows.map((o) => o.id);
    const foodIds = foodRows.map((o) => o.id);
    if (!groceryIds.length && !foodIds.length) return [];

    const [gSettlements, fSettlements] = await Promise.all([
      groceryIds.length ? this.db.select().from(settlements).where(inArray(settlements.groceryOrderId, groceryIds)) : [],
      foodIds.length ? this.db.select().from(settlements).where(inArray(settlements.foodOrderId, foodIds)) : [],
    ]);

    return [...gSettlements, ...fSettlements].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((s) => this.toSummary(s));
  }

  private toSummary(s: typeof settlements.$inferSelect) {
    return {
      id: s.id,
      type: (s.groceryOrderId ? 'grocery' : 'food') as OrderType,
      orderId: (s.groceryOrderId ?? s.foodOrderId)!,
      orderCode: (s.groceryOrderId ?? s.foodOrderId)!.slice(0, 8).toUpperCase(),
      vendorPayout: s.vendorPayout,
      deliveryPayout: s.deliveryPayout,
      platformShare: s.platformShare,
      commissionPctSnapshot: s.commissionPctSnapshot,
      createdAt: s.createdAt,
    };
  }

  // ---------- Payout / Withdrawal with KYC Verification ----------

  async requestVendorWithdrawal(userId: string) {
    const [vendor] = await this.db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    if (!vendor) throw new NotFoundException('Vendor profile not set up yet');

    if (vendor.kycStatus !== 'verified') {
      throw new BadRequestException(
        'KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.',
      );
    }

    if (!vendor.bankAccount && !vendor.upiId) {
      throw new BadRequestException(
        'Please add your Bank Account or UPI ID before requesting a withdrawal so we know where to send your funds.',
      );
    }

    const settlementsList = await this.listForVendor(vendor.id);
    const totalEarnings = settlementsList.reduce((sum, s) => sum + s.vendorPayout, 0);

    const destinationLabel = vendor.upiId
      ? `UPI ID (${vendor.upiId})`
      : `Bank Account (•••• ${vendor.bankAccount?.slice(-4) || ''}, IFSC: ${vendor.bankIfsc || 'N/A'})`;

    return {
      success: true,
      message: `Withdrawal request submitted successfully. Funds will be transferred to your registered ${destinationLabel} within 24 hours.`,
      availableBalance: totalEarnings,
      kycStatus: vendor.kycStatus,
      payoutMethod: vendor.upiId ? 'upi' : 'bank',
      payoutDestination: vendor.upiId || vendor.bankAccount,
      bankIfsc: vendor.bankIfsc ?? null,
    };
  }

  async requestPartnerWithdrawal(userId: string) {
    const [partner] = await this.db.select().from(deliveryPartners).where(eq(deliveryPartners.userId, userId)).limit(1);
    if (!partner) throw new NotFoundException('Delivery partner profile not set up yet');

    if (partner.kycStatus !== 'verified') {
      throw new BadRequestException(
        'KYC verification required before withdrawal. Please upload your Aadhaar card (front and back) to complete verification.',
      );
    }

    const settlementsList = await this.listForPartner(partner.id);
    const totalEarnings = settlementsList.reduce((sum, s) => sum + s.deliveryPayout, 0);

    return {
      success: true,
      message: 'Withdrawal request submitted successfully. Funds will be transferred to your registered bank / UPI account.',
      availableBalance: totalEarnings,
      kycStatus: partner.kycStatus,
    };
  }

  // ---------- Admin ----------

  async listAllForAdmin() {
    const rows = await this.db.select().from(settlements).orderBy(desc(settlements.createdAt)).limit(200);
    return rows.map((s) => this.toSummary(s));
  }
}
