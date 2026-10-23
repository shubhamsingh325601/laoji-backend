import { calcReferralReward } from './wallet.service';
import { generateReferralCode, normalizeReferralCode } from '../../common/utils/referral-code';

describe('calcReferralReward', () => {
  it('pays 5% of the first order subtotal, rounded to paise', () => {
    expect(calcReferralReward(500, 5)).toBe(25);
    expect(calcReferralReward(333, 5)).toBe(16.65);
    expect(calcReferralReward(99.99, 5)).toBe(5);
  });

  it('never pays more than the cap', () => {
    expect(calcReferralReward(500, 5, 15)).toBe(15);
    expect(calcReferralReward(300, 5, 15)).toBe(15);
    expect(calcReferralReward(200, 5, 15)).toBe(10);
  });

  it('pays nothing for an empty order or a zero rate', () => {
    expect(calcReferralReward(0, 5)).toBe(0);
    expect(calcReferralReward(-20, 5)).toBe(0);
    expect(calcReferralReward(500, 0)).toBe(0);
    expect(calcReferralReward(NaN, 5)).toBe(0);
  });
});

describe('referral codes', () => {
  it('generates 8-character codes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferralCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it('normalizes what a user types', () => {
    expect(normalizeReferralCode('  ab12cd34 ')).toBe('AB12CD34');
    expect(normalizeReferralCode(undefined)).toBe('');
    expect(normalizeReferralCode('   ')).toBe('');
  });
});
