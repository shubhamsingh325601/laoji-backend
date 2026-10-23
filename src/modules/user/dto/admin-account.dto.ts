import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  // Optional: admins sign in with their email, but the phone also works at login.
  @IsOptional()
  @Matches(/^\d{10,15}$/, { message: 'phone must be 10-15 digits' })
  phone?: string;

  @IsString()
  @Length(8, 72)
  password: string;
}

export class UpdateAdminAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  // Setting this resets the admin's password and signs them out everywhere.
  @IsOptional()
  @IsString()
  @Length(8, 72)
  password?: string;
}
