import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT,
  VendorWithdrawalService,
} from './vendor-withdrawal.service';

describe('VendorWithdrawalService', () => {
  let service: VendorWithdrawalService;
  let mockDb: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    mockNotifications = {
      notifyPush: jest.fn(),
      notifyEmail: jest.fn(),
    };
    service = new VendorWithdrawalService(mockDb, mockNotifications);
  });

  describe('Minimum withdrawal limit configuration', () => {
    it('has default minimum withdrawal limit of 500', () => {
      expect(DEFAULT_VENDOR_MIN_WITHDRAWAL_LIMIT).toBe(500);
    });

    it('returns default 500 when no platform setting exists in DB', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const limit = await service.getMinWithdrawalLimit();
      expect(limit).toBe(500);
    });

    it('returns configured limit from platform_settings when present', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ value: '1000' }]),
          }),
        }),
      });

      const limit = await service.getMinWithdrawalLimit();
      expect(limit).toBe(1000);
    });

    it('allows admin to update the minimum withdrawal limit', async () => {
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockResolvedValue(true),
        }),
      });

      const res = await service.updateMinWithdrawalLimit(750, 'admin-uuid');
      expect(res.minWithdrawalLimit).toBe(750);
      expect(res.message).toBe('Minimum withdrawal limit updated to ₹750');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('rejects minimum withdrawal limit less than 1', async () => {
      await expect(service.updateMinWithdrawalLimit(0)).rejects.toThrow(BadRequestException);
      await expect(service.updateMinWithdrawalLimit(-100)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Withdrawal request enforcement', () => {
    const verifiedVendor = {
      id: 'vendor-123',
      userId: 'user-123',
      kycStatus: 'verified',
      upiId: 'vendor@upi',
      bankAccount: null,
      bankIfsc: null,
    };

    it('rejects withdrawal if available balance is below minimum withdrawal limit (default 500)', async () => {
      // Mock vendor lookup
      jest.spyOn(service as any, 'vendorForUser').mockResolvedValue(verifiedVendor);
      // Mock open withdrawal check -> none open
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      // Mock balance of ₹300 (which is less than ₹500)
      jest.spyOn(service, 'getBalance').mockResolvedValue({
        availableBalance: 300,
        totalEarned: 300,
        totalWithdrawn: 0,
        pendingAmount: 0,
      });
      // Mock default limit of 500
      jest.spyOn(service, 'getMinWithdrawalLimit').mockResolvedValue(500);

      await expect(service.request('user-123', 300)).rejects.toThrow(
        /Minimum withdrawal limit is ₹500\. Your current available balance is ₹300\./,
      );
    });

    it('rejects withdrawal if requested amount is below minimum withdrawal limit', async () => {
      jest.spyOn(service as any, 'vendorForUser').mockResolvedValue(verifiedVendor);
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      // Available balance is ₹1000 (enough), but requests only ₹250 (< 500)
      jest.spyOn(service, 'getBalance').mockResolvedValue({
        availableBalance: 1000,
        totalEarned: 1000,
        totalWithdrawn: 0,
        pendingAmount: 0,
      });
      jest.spyOn(service, 'getMinWithdrawalLimit').mockResolvedValue(500);

      await expect(service.request('user-123', 250)).rejects.toThrow(
        /Minimum withdrawal amount is ₹500\. You requested ₹250\./,
      );
    });

    it('accepts withdrawal if requested amount and available balance meet the minimum limit', async () => {
      jest.spyOn(service as any, 'vendorForUser').mockResolvedValue(verifiedVendor);
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      // Available balance is ₹1000, requesting ₹600 (>= 500)
      jest.spyOn(service, 'getBalance').mockResolvedValue({
        availableBalance: 1000,
        totalEarned: 1000,
        totalWithdrawn: 0,
        pendingAmount: 0,
      });
      jest.spyOn(service, 'getMinWithdrawalLimit').mockResolvedValue(500);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'withdrawal-1', amount: 600 }]),
        }),
      });

      const res = await service.request('user-123', 600);
      expect(res.success).toBe(true);
      expect(res.amount).toBe(600);
      expect(res.withdrawalId).toBe('withdrawal-1');
      expect(res.availableBalance).toBe(400);
    });
  });
});
