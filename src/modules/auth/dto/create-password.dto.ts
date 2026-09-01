import { IsString, Length } from 'class-validator';

export class CreatePasswordDto {
  @IsString()
  @Length(4, 100, { message: 'Password must be at least 4 characters long' })
  newPassword: string;
}
