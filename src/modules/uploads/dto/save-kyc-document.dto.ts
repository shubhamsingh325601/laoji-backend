import { IsString, IsUrl, Length } from 'class-validator';

export class SaveKycDocumentDto {
  @IsString()
  @Length(1, 50)
  docType: string;

  @IsUrl()
  secureUrl: string;

  @IsString()
  @Length(1, 255)
  publicId: string;
}
