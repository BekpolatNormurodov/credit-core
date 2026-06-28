import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductType, WorkflowDecision } from '@credit-core/shared';

export class BorrowerInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @IsString() birthDate?: string | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() phone?: string | null;
}

export class CollateralOwnerInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @IsNumber() sharePercent?: number | null;
}

export class RealEstateInput {
  @IsString() @MinLength(1) address!: string;
  @IsOptional() @IsString() registryNo?: string | null;
  @IsOptional() @IsString() propertyType?: string | null;
  @IsOptional() @IsString() cadastreNo?: string | null;
  @IsOptional() @IsString() registrationDate?: string | null;
  @IsOptional() @IsNumber() totalAreaM2?: number | null;
  @IsOptional() @IsNumber() livingAreaM2?: number | null;
  @IsOptional() @IsString() roomNames?: string | null;
  @IsOptional() @IsInt() roomCount?: number | null;
  @IsOptional() @IsNumber() agreedValue?: number | null;
  @IsOptional() @IsString() agreedValueWords?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollateralOwnerInput)
  owners?: CollateralOwnerInput[];
}

export class UpsertRealEstateCaseDto {
  @IsOptional() @IsNumber() @Min(0) amount?: number | null;
  @IsOptional() @IsInt() @Min(1) termMonths?: number | null;

  @ValidateNested()
  @Type(() => BorrowerInput)
  borrower!: BorrowerInput;

  @ValidateNested()
  @Type(() => RealEstateInput)
  realEstate!: RealEstateInput;
}

export class CreateCaseDto extends UpsertRealEstateCaseDto {
  @IsEnum(ProductType) productType!: ProductType;
}

export class TransitionDto {
  @IsEnum(WorkflowDecision) decision!: WorkflowDecision;
  @IsOptional() @IsString() comment?: string;
}

export class SetKatmPriceDto {
  @IsNumber() @Min(0) katmPrice!: number;
}
