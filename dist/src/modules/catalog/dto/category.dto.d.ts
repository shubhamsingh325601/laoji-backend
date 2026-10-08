export declare class CreateCategoryDto {
    name: string;
    parentId?: string | null;
    imageUrl?: string;
    businessType?: string;
}
export declare class UpdateCategoryDto {
    name?: string;
    parentId?: string | null;
    imageUrl?: string;
    businessType?: string;
}
export declare class CreateVendorCategoryDto {
    name?: string;
    templateCategoryId?: string;
}
export declare class UpdateVendorCategoryDto {
    name: string;
}
