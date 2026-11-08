export declare const HOME_TAB_KEYS: readonly ["grocery", "veg", "non_veg"];
export type HomeTabKey = (typeof HOME_TAB_KEYS)[number];
export declare class HomeTabDto {
    key: HomeTabKey;
    label: string;
    isActive: boolean;
}
export declare class UpdateHomeTabsDto {
    tabs: HomeTabDto[];
}
