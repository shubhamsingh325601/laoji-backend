import { IsArray, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

export const NOTIFICATION_TARGETS = ['all', 'customer', 'vendor', 'restaurant', 'delivery_partner', 'user'] as const;
export type NotificationTarget = (typeof NOTIFICATION_TARGETS)[number];

export const NOTIFICATION_CHANNELS = ['push', 'email', 'sms', 'all'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export class SendAdminNotificationDto {
  @IsIn(NOTIFICATION_TARGETS)
  target: NotificationTarget;

  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS)
  channel?: NotificationChannel;

  @IsOptional()
  @IsArray()
  channels?: ('push' | 'email' | 'sms')[];

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Length(1, 200)
  title: string;

  @IsString()
  @Length(1, 4000)
  message: string;
}
