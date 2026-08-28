export declare class CreateAdminDeliveryPartnerDto {
    name: string;
    phone: string;
    email?: string;
    vehicleType: 'bike' | 'scooter' | 'bicycle';
    city?: string;
    kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
}
export declare class UpdateAdminDeliveryPartnerDto {
    name?: string;
    phone?: string;
    email?: string;
    vehicleType?: 'bike' | 'scooter' | 'bicycle';
    city?: string;
    kycStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
    status?: 'active' | 'suspended';
    isAvailable?: boolean;
}
