import { IsString, Length } from 'class-validator';

export class ContactSupportDto {
  @IsString()
  @Length(1, 200)
  subject: string;

  @IsString()
  @Length(1, 2000)
  message: string;
}
