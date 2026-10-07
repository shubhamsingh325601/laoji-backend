import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class AdjustWalletDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsString()
  @IsIn(['credit', 'debit'], { message: 'action must be "credit" or "debit"' })
  action: 'credit' | 'debit';

  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than zero' })
  amount: number;

  @IsString()
  @MinLength(2, { message: 'Reason/description must be at least 2 characters' })
  description: string;
}
