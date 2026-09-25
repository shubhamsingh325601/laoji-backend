import { BadRequestException } from '@nestjs/common';
import {
  laojiCategoryId,
  normalizeAttributes,
  ownCopiesByTemplate,
  productDetailChanges,
  shopCategoryId,
  type ProductDetailColumns,
} from './catalog-ownership';
import { productFormFor, readProductAttributes } from './product-forms';

const category = (id: string, ownerVendorId: string | null = null, templateCategoryId: string | null = null) => ({
  id,
  ownerVendorId,
  templateCategoryId,
});

describe('store categories', () => {
  const all = [
    category('dairy'),
    category('snacks'),
    category('v1-milk', 'v1', 'dairy'),
    category('v1-pooja', 'v1'),
    category('v2-dairy', 'v2', 'dairy'),
  ];
  const copies = ownCopiesByTemplate(all, 'v1');

  it("indexes only the vendor's own copies of Laoji categories", () => {
    expect([...copies.keys()]).toEqual(['dairy']);
    expect(copies.get('dairy')?.id).toBe('v1-milk');
  });

  it("shows a Laoji product under the store's copy of its category, else under Laoji's", () => {
    expect(shopCategoryId('dairy', copies)).toBe('v1-milk');
    expect(shopCategoryId('snacks', copies)).toBe('snacks');
    expect(shopCategoryId('v1-pooja', copies)).toBe('v1-pooja');
  });

  it("files a store's copy under the Laoji category for customers, and its own ones under themselves", () => {
    const byId = new Map(all.map((c) => [c.id, c]));
    expect(laojiCategoryId('v1-milk', byId)).toBe('dairy');
    expect(laojiCategoryId('v2-dairy', byId)).toBe('dairy');
    expect(laojiCategoryId('v1-pooja', byId)).toBe('v1-pooja');
    expect(laojiCategoryId('dairy', byId)).toBe('dairy');
    expect(laojiCategoryId('unknown', byId)).toBe('unknown');
  });
});

describe('product detail changes', () => {
  const laojiSoap: ProductDetailColumns = {
    name: 'Lux Soap',
    brand: 'Lux',
    categoryId: 'personal-care',
    unit: 'piece',
    size: '100 g',
    mrp: 40,
    imageUrl: 'https://img/lux.jpg',
    description: 'Bathing soap',
    attributes: null,
  };
  const inPlace = (id: string) => id === 'personal-care';

  it('finds nothing when an app build sends every detail back unchanged', () => {
    expect(
      productDetailChanges(
        laojiSoap,
        {
          name: ' Lux Soap ',
          brand: 'Lux',
          categoryId: 'personal-care',
          unit: 'piece',
          size: '100 g',
          mrp: 40,
          imageUrl: 'https://img/lux.jpg',
          description: 'Bathing soap',
          attributes: {},
        },
        inPlace,
      ),
    ).toEqual({});
  });

  it('treats a missing field as kept and blank optional text as cleared', () => {
    expect(productDetailChanges(laojiSoap, { brand: '', size: '  ' }, inPlace)).toEqual({ brand: null, size: null });
    expect(productDetailChanges(laojiSoap, { mrp: null }, inPlace)).toEqual({ mrp: null });
    expect(productDetailChanges({ ...laojiSoap, brand: null }, { brand: '' }, inPlace)).toEqual({});
  });

  it('reports the fields the vendor changed', () => {
    expect(
      productDetailChanges(laojiSoap, { name: 'Lux Rose Soap', mrp: 45, imageUrl: 'https://img/mine.jpg' }, inPlace),
    ).toEqual({ name: 'Lux Rose Soap', mrp: 45, imageUrl: 'https://img/mine.jpg' });
  });

  it("counts a move only when the category isn't where the product already is", () => {
    const sameShelf = (id: string) => id === 'v1-bath';
    expect(productDetailChanges(laojiSoap, { categoryId: 'v1-bath' }, sameShelf)).toEqual({});
    expect(productDetailChanges(laojiSoap, { categoryId: 'v1-daily' }, sameShelf)).toEqual({ categoryId: 'v1-daily' });
  });

  it('rejects a blank name or unit', () => {
    expect(() => productDetailChanges(laojiSoap, { name: '  ' }, inPlace)).toThrow(BadRequestException);
    expect(() => productDetailChanges(laojiSoap, { unit: '' }, inPlace)).toThrow(BadRequestException);
  });

  it('compares form details by value, with unset toggles and empty values ignored', () => {
    expect(productDetailChanges(laojiSoap, { attributes: { organic: false, foodType: '' } }, inPlace)).toEqual({});
    expect(productDetailChanges(laojiSoap, { attributes: { foodType: 'Veg' } }, inPlace)).toEqual({
      attributes: { foodType: 'Veg' },
    });
    const veg = { ...laojiSoap, attributes: { foodType: 'Veg', organic: true } };
    expect(productDetailChanges(veg, { attributes: { organic: true, foodType: 'Veg' } }, inPlace)).toEqual({});
    expect(productDetailChanges(veg, { attributes: { foodType: 'Veg' } }, inPlace)).toEqual({
      attributes: { foodType: 'Veg' },
    });
  });

  it('normalizes form details to sorted non-empty values, or null', () => {
    expect(normalizeAttributes({ b: 1, a: 'x', c: false, d: '' })).toEqual({ a: 'x', b: 1 });
    expect(Object.keys(normalizeAttributes({ b: 1, a: 'x' })!)).toEqual(['a', 'b']);
    expect(normalizeAttributes({ c: false })).toBeNull();
    expect(normalizeAttributes(undefined)).toBeNull();
  });
});

describe('form details on a Laoji product', () => {
  it('checks only the details given, not required ones or product columns', () => {
    const medical = productFormFor('medical');
    // Laoji's products have no form details and may use units the form doesn't offer.
    expect(readProductAttributes(medical, { name: 'Dolo', unit: 'box', attributes: {} }, { requireAll: false })).toEqual(
      {},
    );
    expect(() => readProductAttributes(medical, { name: 'Dolo', unit: 'box', attributes: {} })).toThrow(
      BadRequestException,
    );
    const fruit = productFormFor('vegetables_fruits');
    expect(
      readProductAttributes(fruit, { name: 'Tomato', unit: '3 kg', attributes: { organic: true } }, { requireAll: false }),
    ).toEqual({ organic: true });
    expect(() =>
      readProductAttributes(medical, { name: 'Dolo', unit: 'box', attributes: { dosageForm: 'Gummy' } }, { requireAll: false }),
    ).toThrow(BadRequestException);
  });
});
