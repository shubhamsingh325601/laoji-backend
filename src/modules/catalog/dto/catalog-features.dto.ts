import { IsBoolean } from 'class-validator';

export class UpdateCatalogFeaturesDto {
  @IsBoolean()
  grocerySizes: boolean;
}
