import { Logger } from '@nestjs/common';
import type { Db } from '../../config/database.module';
import { NewCustomerDeliveryService } from './new-customer-delivery.service';

describe('NewCustomerDeliveryService free-delivery thresholds', () => {
  type ThresholdRow = {
    fromKm: number;
    toKm: number | null;
    minOrderAmount: number;
  };

  let service: NewCustomerDeliveryService;
  let queryResult: Promise<ThresholdRow[]>;

  beforeEach(() => {
    queryResult = Promise.resolve([]);
    const mockDb = {
      select: () => ({
        from: () => ({
          orderBy: () => queryResult,
        }),
      }),
    };
    service = new NewCustomerDeliveryService(mockDb as unknown as Db);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the global threshold when the new tier table is not yet migrated', async () => {
    const missingTableError = Object.assign(new Error('query failed'), {
      cause: Object.assign(
        new Error('relation "delivery_free_threshold_tiers" does not exist'),
        { code: '42P01' },
      ),
    });
    queryResult = Promise.reject(missingTableError);
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(service.freeDeliveryThreshold(2, 99)).resolves.toBe(99);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Apply migration 0022'),
    );
  });

  it('does not hide unrelated database errors', async () => {
    const error = new Error('database connection lost');
    queryResult = Promise.reject(error);

    await expect(service.freeDeliveryThreshold(2, 99)).rejects.toBe(error);
  });

  it('uses the configured distance tier when available', async () => {
    queryResult = Promise.resolve([
      { fromKm: 0, toKm: null, minOrderAmount: 150 },
    ]);

    await expect(service.freeDeliveryThreshold(2, 99)).resolves.toBe(150);
  });
});
