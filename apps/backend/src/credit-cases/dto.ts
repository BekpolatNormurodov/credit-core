import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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

export class CollateralInput {
  @IsEnum(ProductType) type!: ProductType;
  @IsOptional() @IsNumber() agreedValue?: number | null;
  @IsOptional() @IsString() agreedValueWords?: string | null;

  // real estate
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() registryNo?: string | null;
  @IsOptional() @IsString() propertyType?: string | null;
  @IsOptional() @IsString() cadastreNo?: string | null;
  @IsOptional() @IsString() registrationDate?: string | null;
  @IsOptional() @IsNumber() totalAreaM2?: number | null;
  @IsOptional() @IsNumber() livingAreaM2?: number | null;
  @IsOptional() @IsString() roomNames?: string | null;
  @IsOptional() @IsInt() roomCount?: number | null;

  // auto
  @IsOptional() @IsString() techPassportNo?: string | null;
  @IsOptional() @IsString() techPassportDate?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() stateNumber?: string | null;
  @IsOptional() @IsString() bodyType?: string | null;
  @IsOptional() @IsString() bodyNo?: string | null;
  @IsOptional() @IsString() engineNo?: string | null;
  @IsOptional() @IsString() chassis?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsInt() year?: number | null;
  @IsOptional() @IsInt() mileage?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollateralOwnerInput)
  owners?: CollateralOwnerInput[];
}

export class UpsertCaseDto {
  @IsOptional() @IsNumber() @Min(0) amount?: number | null;
  @IsOptional() @IsInt() @Min(1) termMonths?: number | null;

  @ValidateNested()
  @Type(() => BorrowerInput)
  borrower!: BorrowerInput;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CollateralInput)
  collaterals!: CollateralInput[];
}

export class TransitionDto {
  @IsEnum(WorkflowDecision) decision!: WorkflowDecision;
  @IsOptional() @IsString() comment?: string;
}

export class SetKatmPriceDto {
  @IsNumber() @Min(0) katmPrice!: number;
}
