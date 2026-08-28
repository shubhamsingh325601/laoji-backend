import type { OtpRole } from '../auth.types';
export declare class VerifyOtpDto {
    phone: string;
    role: OtpRole;
    code: string;
    deviceId?: string;
}
