import type { Db } from '../../config/database.module';
export declare const BUSINESS_TYPES_SETTING = "platform_business_types";
export declare const HOME_TABS_SETTING = "platform_home_tabs";
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
export declare const DEFAULT_PLATFORM_BUSINESS_TYPES: BusinessTypeItem[];
export declare const DEFAULT_PLATFORM_HOME_TABS: HomeTabItem[];
export declare class BusinessTypesService {
    private readonly db;
    constructor(db: Db);
    getBusinessTypes(): Promise<BusinessTypeItem[]>;
    getPublicBusinessTypes(): Promise<BusinessTypeItem[]>;
    updateBusinessTypes(types: BusinessTypeItem[], adminId?: string): Promise<BusinessTypeItem[]>;
    getHomeTabs(): Promise<HomeTabItem[]>;
    updateHomeTabs(tabs: HomeTabItem[], adminId?: string): Promise<HomeTabItem[]>;
}
