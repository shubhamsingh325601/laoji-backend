export declare class ForgotPasswordRequestDto {
    phone: string;
    role?: 'vendor' | 'customer' | 'delivery_partner';
}
export declare class ForgotPasswordResetDto {
    phone: string;
    code: string;
    newPassword: string;
    role?: 'vendor' | 'customer' | 'delivery_partner';
}
