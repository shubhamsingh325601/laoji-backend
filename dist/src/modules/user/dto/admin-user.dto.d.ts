export declare class CreateAdminUserDto {
    name?: string;
    phone: string;
    email?: string;
    role?: 'customer' | 'vendor' | 'delivery_partner' | 'admin';
    status?: 'active' | 'suspended';
    address?: string;
    city?: string;
}
export declare class UpdateAdminUserDto {
    name?: string;
    phone?: string;
    email?: string;
    role?: 'customer' | 'vendor' | 'delivery_partner' | 'admin';
    status?: 'active' | 'suspended';
    supportNotes?: string;
}
