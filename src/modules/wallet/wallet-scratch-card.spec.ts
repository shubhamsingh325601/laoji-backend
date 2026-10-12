import { NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';

const card = (over: Record<string, unknown> = {}) => ({
  id: 'card-1',
  userId: 'user-1',
  orderId: '11111111-2222-3333-4444-555555555555',
  orderType: 'grocery',
  status: 'scratched',
  amount: 3,
  scratchedAt: new Date(),
  createdAt: new Date(),
  ...over,
});

// A tx whose first update().returning() yields `won` and whose select() yields `existing`.
function makeTx(won: unknown[], existing: unknown[]) {
  const inserted: unknown[] = [];
  const walletUpdates: unknown[] = [];
  let updateCall = 0;
  const tx = {
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation((values: unknown) => ({
        where: jest.fn().mockImplementation(() => {
          updateCall += 1;
          if (updateCall === 1) return { returning: jest.fn().mockResolvedValue(won) };
          walletUpdates.push(values);
          return Promise.resolve();
        }),
      })),
    })),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation((v: unknown) => {
        inserted.push(v);
        return Promise.resolve();
      }),
    })),
    select: jest.fn().mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(existing) }) }),
    })),
  };
  return { tx, inserted, walletUpdates };
}

describe('WalletService scratch cards', () => {
  let service: WalletService;
  let db: any;

  const setup = (won: unknown[], existing: unknown[]) => {
    const made = makeTx(won, existing);
    db = { transaction: jest.fn().mockImplementation((fn: any) => fn(made.tx)) };
    service = new WalletService(db, { notifyPush: jest.fn() } as any);
    jest.spyOn(service, 'getOrCreateWallet').mockResolvedValue({ id: 'wallet-1' } as any);
    jest
      .spyOn(service, 'getWalletSummary')
      .mockResolvedValue({ wallet: { balance: 42 } } as any);
    return made;
  };

  it('credits the wallet with the rolled amount (₹1–₹5) exactly once', async () => {
    const { inserted, walletUpdates } = setup([card({ status: 'scratched', amount: 4 })], []);

    const result = await service.scratchCard('user-1', 'card-1');

    expect(result.justScratched).toBe(true);
    expect(result.walletBalance).toBe(42);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ type: 'scratch_card', status: 'completed', userId: 'user-1' });
    expect(walletUpdates).toHaveLength(1);
  });

  it('never rolls outside 1..5', async () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i += 1) {
      let rolled = 0;
      const tx = {
        update: () => ({
          set: (v: any) => ({
            where: () => {
              if (v.status === 'scratched') rolled = v.amount;
              // The card update is awaited via .returning(); the wallet update is awaited directly.
              const p: any = Promise.resolve();
              p.returning = () => Promise.resolve([card({ amount: rolled })]);
              return p;
            },
          }),
        }),
        insert: () => ({ values: () => Promise.resolve() }),
      };
      const local = new WalletService({ transaction: (fn: any) => fn(tx) } as any, {} as any);
      jest.spyOn(local, 'getOrCreateWallet').mockResolvedValue({ id: 'w' } as any);
      jest.spyOn(local, 'getWalletSummary').mockResolvedValue({ wallet: { balance: 0 } } as any);
      await local.scratchCard('user-1', 'card-1');
      seen.add(rolled);
    }
    expect([...seen].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('does not pay again for an already scratched card', async () => {
    const { inserted, walletUpdates } = setup([], [card({ amount: 2 })]);

    const result = await service.scratchCard('user-1', 'card-1');

    expect(result.justScratched).toBe(false);
    expect(result.amount).toBe(2);
    expect(inserted).toHaveLength(0);
    expect(walletUpdates).toHaveLength(0);
  });

  it("404s on someone else's or a missing card", async () => {
    setup([], []);
    await expect(service.scratchCard('user-1', 'nope')).rejects.toThrow(NotFoundException);
  });
});
