export declare const DEVICE_PLATFORMS: readonly ["ios", "android", "web"];
export declare class RegisterDeviceTokenDto {
    fcmToken: string;
    platform: (typeof DEVICE_PLATFORMS)[number];
}
