import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../../config/database.module';
import { DRIZZLE } from '../../config/database.module';
import { platformSettings } from '../../../drizzle/schema';

export const BUSINESS_TYPES_SETTING = 'platform_business_types';
export const HOME_TABS_SETTING = 'platform_home_tabs';

export interface BusinessTypeItem {
  id: string;
  label: string;
  labelHindi: string;
  icon: string;
  isActive: boolean;
  allowVendorSignup: boolean;
  displayOrder: number;
  description?: string;
}

export interface HomeTabItem {
  key: string;
  label: string;
  isActive: boolean;
}

export const DEFAULT_PLATFORM_BUSINESS_TYPES: BusinessTypeItem[] = [
  { id: 'grocery', label: 'Grocery & Essentials', labelHindi: 'किराना और राशन', icon: 'shopping-basket', isActive: true, allowVendorSignup: true, displayOrder: 1 },
  { id: 'restaurant', label: 'Restaurant & Eatery', labelHindi: 'रेस्टोरेंट और खाना', icon: 'restaurant', isActive: true, allowVendorSignup: true, displayOrder: 2 },
  { id: 'stationery', label: 'Stationery & Books', labelHindi: 'स्टेशनरी और किताबें', icon: 'menu-book', isActive: true, allowVendorSignup: true, displayOrder: 3 },
  { id: 'vegetables', label: 'Vegetables', labelHindi: 'ताजी सब्जियां', icon: 'eco', isActive: true, allowVendorSignup: true, displayOrder: 4 },
  { id: 'fruits', label: 'Fruits', labelHindi: 'ताजे फल', icon: 'apple', isActive: true, allowVendorSignup: true, displayOrder: 5 },
  { id: 'dairy', label: 'Dairy & Milk', labelHindi: 'दूध और डेयरी', icon: 'local-drink', isActive: true, allowVendorSignup: true, displayOrder: 6 },
  { id: 'bakery', label: 'Bakery & Sweets', labelHindi: 'मिठाई और बेकरी', icon: 'cake', isActive: true, allowVendorSignup: true, displayOrder: 7 },
  { id: 'vegetables_fruits', label: 'Fruits & Vegetables', labelHindi: 'फल और सब्जियां', icon: 'eco', isActive: false, allowVendorSignup: true, displayOrder: 8 },
  { id: 'medical', label: 'Pharmacy & Medical', labelHindi: 'दवाई और मेडिकल', icon: 'local-pharmacy', isActive: true, allowVendorSignup: true, displayOrder: 9 },
  { id: 'clothing', label: 'Clothing & Fashion', labelHindi: 'कपड़े और परिधान', icon: 'checkroom', isActive: true, allowVendorSignup: true, displayOrder: 10 },
  { id: 'electronics', label: 'Electronics & Repairs', labelHindi: 'इलेक्ट्रॉनिक्स और मोबाइल', icon: 'devices', isActive: true, allowVendorSignup: true, displayOrder: 11 },
  { id: 'general', label: 'General Store', labelHindi: 'जनरल स्टोर', icon: 'storefront', isActive: true, allowVendorSignup: true, displayOrder: 12 },
];

export const DEFAULT_PLATFORM_HOME_TABS: HomeTabItem[] = [
  { key: 'grocery', label: 'Grocery', isActive: true },
  { key: 'veg', label: 'Veg', isActive: true },
  { key: 'non_veg', label: 'Non-Veg', isActive: true },
];

@Injectable()
export class BusinessTypesService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async getBusinessTypes(): Promise<BusinessTypeItem[]> {
    try {
      const [row] = await this.db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, BUSINESS_TYPES_SETTING))
        .limit(1);
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }
    return DEFAULT_PLATFORM_BUSINESS_TYPES;
  }

  async getPublicBusinessTypes(): Promise<BusinessTypeItem[]> {
    const all = await this.getBusinessTypes();
    return all.filter((b) => b.isActive);
  }

  async updateBusinessTypes(types: BusinessTypeItem[], adminId?: string): Promise<BusinessTypeItem[]> {
    const value = JSON.stringify(types);
    await this.db
      .insert(platformSettings)
      .values({
        key: BUSINESS_TYPES_SETTING,
        value,
        description: 'Admin-configured supported business types and modules',
        updatedAt: new Date(),
        updatedBy: adminId || null,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value,
          updatedAt: new Date(),
          updatedBy: adminId || null,
        },
      });
    return types;
  }

  async getHomeTabs(): Promise<HomeTabItem[]> {
    try {
      const [row] = await this.db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, HOME_TABS_SETTING))
        .limit(1);
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall through to default
    }
    return DEFAULT_PLATFORM_HOME_TABS;
  }

  async updateHomeTabs(tabs: HomeTabItem[], adminId?: string): Promise<HomeTabItem[]> {
    const value = JSON.stringify(tabs);
    await this.db
      .insert(platformSettings)
      .values({
        key: HOME_TABS_SETTING,
        value,
        description: 'Customer app home tabs configuration',
        updatedAt: new Date(),
        updatedBy: adminId || null,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value,
          updatedAt: new Date(),
          updatedBy: adminId || null,
        },
      });
    return tabs;
  }
}
