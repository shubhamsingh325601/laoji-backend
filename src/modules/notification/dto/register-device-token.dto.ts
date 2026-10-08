import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { NOTIFICATION_SOUND_PATTERN } from '../notification-sound';

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(10)
  fcmToken: string;

  @IsIn(DEVICE_PLATFORMS)
  platform: (typeof DEVICE_PLATFORMS)[number];

  // Sound the vendor picked in the app. Omitted by apps that don't offer a choice.
  @IsOptional()
  @IsString()
  @Matches(NOTIFICATION_SOUND_PATTERN, { message: 'notificationSound must be 1-40 lowercase letters, digits or underscores' })
  notificationSound?: string;
}
