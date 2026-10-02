import { IsIn, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class RequestWithdrawalDto {
  @IsNumber()
  @IsPositive()
  @Min(10, { message: 'Minimum withdrawal amount is ₹10' })
  amount: number;

  @IsString()
  @IsIn(['upi', 'bank'], { message: 'payoutMethod must be "upi" or "bank"' })
  payoutMethod: 'upi' | 'bank';

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;
}

export class ProcessWithdrawalDto {
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
