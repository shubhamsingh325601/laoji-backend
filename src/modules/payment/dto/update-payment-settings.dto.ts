import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/, {
    message: 'Please provide a valid UPI ID (e.g. 8005949152-3@ybl or store@okhdfcbank)',
  })
  upiId: string;

  @IsString()
  @IsOptional()
  payeeName?: string;
}
