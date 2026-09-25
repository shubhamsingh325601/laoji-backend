import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCategorySuggestionDto {
  @IsString()
  @Length(2, 150)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

// Admin may tidy the name or file it under another parent than the
// suggesting store type's root.
export class ApproveCategorySuggestionDto {
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
