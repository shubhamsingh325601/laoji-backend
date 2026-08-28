export declare class BusinessHoursDayDto {
    day: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
}
export declare class UpdateBusinessHoursDto {
    isOpen: boolean;
    schedule?: BusinessHoursDayDto[];
}
