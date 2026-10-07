import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';

describe('WalletService Admin Operations', () => {
  let service: WalletService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const mockNotifications = {
      notifyPush: jest.fn(),
      notifyEmail: jest.fn(),
    };
    service = new WalletService(mockDb, mockNotifications as any);
  });

  describe('adjustWallet validation', () => {
    it('throws BadRequestException if neither userId nor vendorId is provided', async () => {
      await expect(
        service.adjustWallet({
          action: 'credit',
          amount: 100,
          description: 'Bonus',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if amount is zero or negative', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 'user-1', name: 'Test User' }]),
          }),
        }),
      });

      await expect(
        service.adjustWallet({
          userId: 'user-1',
          action: 'credit',
          amount: -50,
          description: 'Invalid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if description is empty', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 'user-1', name: 'Test User' }]),
          }),
        }),
      });

      await expect(
        service.adjustWallet({
          userId: 'user-1',
          action: 'credit',
          amount: 50,
          description: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when debiting more than available balance', async () => {
      // 1. mock user lookup
      // 2. mock getOrCreateWallet
      let callCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // User lookup
                return Promise.resolve([{ id: 'user-1', name: 'Test Customer' }]);
              }
              // Wallet lookup
              return Promise.resolve([{ id: 'wallet-1', userId: 'user-1', balance: 40 }]);
            }),
          }),
        }),
      }));

      await expect(
        service.adjustWallet({
          userId: 'user-1',
          action: 'debit',
          amount: 100,
          description: 'Penalty',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
