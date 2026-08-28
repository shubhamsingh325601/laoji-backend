export declare class CreateAddressDto {
    label?: string;
    lat: number;
    lng: number;
    formattedAddress: string;
    isDefault?: boolean;
}
export declare class UpdateAddressDto {
    label?: string;
    lat?: number;
    lng?: number;
    formattedAddress?: string;
    isDefault?: boolean;
}
