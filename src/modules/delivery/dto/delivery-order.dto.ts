import { IsIn, IsString, Length } from 'class-validator';

export const DELIVERY_FORWARD_STATUSES = ['picked_up', 'out_for_delivery'] as const;

export class AdvanceDeliveryStatusDto {
  @IsIn(DELIVERY_FORWARD_STATUSES)
  status: (typeof DELIVERY_FORWARD_STATUSES)[number];
}

export class VerifyDeliveryDto {
  @IsString()
  @Length(4, 6)
  otp: string;
}
