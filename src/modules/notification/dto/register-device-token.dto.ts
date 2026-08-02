import { IsIn, IsString, MinLength } from 'class-validator';

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(10)
  fcmToken: string;

  @IsIn(DEVICE_PLATFORMS)
  platform: (typeof DEVICE_PLATFORMS)[number];
}
