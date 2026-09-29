export declare const BANNER_PLACEMENTS: readonly ["home", "promo", "order"];
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];
export declare class CreateBannerDto {
    title: string;
    subtitle?: string | null;
    imageUrl: string;
    link?: string | null;
    placement?: BannerPlacement;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
}
export declare class UpdateBannerDto {
    title?: string;
    subtitle?: string | null;
    imageUrl?: string;
    link?: string | null;
    placement?: BannerPlacement;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
}
