import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VendorRegisterDto } from './dto/vendor-register.dto';
import { UpsertVendorProfileDto } from '../catalog/dto/vendor-profile.dto';

describe('Vendor Registration & Profile Radius Validation', () => {
  const baseRegisterPayload = {
    phone: '9876543210',
    email: 'vendor@example.com',
    password: 'password123',
    businessName: 'Super Fresh Store',
    ownerName: 'Ramesh Kumar',
    type: 'grocery' as const,
    shopAddress: 'Main Market, Sangod',
    pickupLat: 24.924,
    pickupLng: 76.283,
  };

  const baseProfilePayload = {
    businessName: 'Super Fresh Store',
    ownerName: 'Ramesh Kumar',
    type: 'grocery' as const,
    shopAddress: 'Main Market, Sangod',
    pickupLat: 24.924,
    pickupLng: 76.283,
  };

  describe('VendorRegisterDto - radiusKm validation', () => {
    it.each([10, 50, 51, 100, 250, 2000])('allows valid positive radius of %i KM without 50 KM cap', async (radiusKm) => {
      const dto = plainToInstance(VendorRegisterDto, {
        ...baseRegisterPayload,
        radiusKm,
      });

      const errors = await validate(dto);
      const radiusErrors = errors.filter((e) => e.property === 'radiusKm');
      expect(radiusErrors).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('allows omitting radiusKm as it is optional', async () => {
      const dto = plainToInstance(VendorRegisterDto, baseRegisterPayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-positive and below-minimum values (< 0.5 KM)', async () => {
      for (const invalidRadius of [-10, 0, 0.2]) {
        const dto = plainToInstance(VendorRegisterDto, {
          ...baseRegisterPayload,
          radiusKm: invalidRadius,
        });

        const errors = await validate(dto);
        const radiusErrors = errors.filter((e) => e.property === 'radiusKm');
        expect(radiusErrors.length).toBeGreaterThan(0);
        expect(radiusErrors[0].constraints).toHaveProperty('min');
      }
    });

    it('rejects non-numeric values', async () => {
      const dto = plainToInstance(VendorRegisterDto, {
        ...baseRegisterPayload,
        radiusKm: 'invalid_radius' as any,
      });

      const errors = await validate(dto);
      const radiusErrors = errors.filter((e) => e.property === 'radiusKm');
      expect(radiusErrors.length).toBeGreaterThan(0);
      expect(radiusErrors[0].constraints).toHaveProperty('isNumber');
    });
  });

  describe('UpsertVendorProfileDto - radiusKm validation', () => {
    it.each([10, 50, 51, 100, 250, 2000])('allows valid positive radius of %i KM without 50 KM cap', async (radiusKm) => {
      const dto = plainToInstance(UpsertVendorProfileDto, {
        ...baseProfilePayload,
        radiusKm,
      });

      const errors = await validate(dto);
      const radiusErrors = errors.filter((e) => e.property === 'radiusKm');
      expect(radiusErrors).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it('allows omitting radiusKm as it is optional', async () => {
      const dto = plainToInstance(UpsertVendorProfileDto, baseProfilePayload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid radiusKm (< 0.5 or non-number)', async () => {
      const dto = plainToInstance(UpsertVendorProfileDto, {
        ...baseProfilePayload,
        radiusKm: 0,
      });

      const errors = await validate(dto);
      const radiusErrors = errors.filter((e) => e.property === 'radiusKm');
      expect(radiusErrors.length).toBeGreaterThan(0);
      expect(radiusErrors[0].constraints).toHaveProperty('min');
    });
  });
});
