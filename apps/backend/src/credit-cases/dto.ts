import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: 'MALE' | 'FEMALE' | null;
  @IsOptional() @IsString() citizenship?: string | null;
  @IsOptional() @IsString() placeOfBirth?: string | null;
  @IsOptional() @IsString() previousName?: string | null;
  @IsOptional() @IsString() inn?: string | null;
  @IsOptional() @IsString() passportIssuer?: string | null;
  @IsOptional() @IsString() passportIssueDate?: string | null;
  @IsOptional() @IsString() passportExpiry?: string | null;
  @IsOptional() @IsString() regAddress?: string | null;
  @IsOptional() @IsString() regLandmark?: string | null;
  @IsOptional() @IsString() regTenure?: string | null;
  @IsOptional() @IsBoolean() regMatchesActual?: boolean | null;
  @IsOptional() @IsString() actualAddress?: string | null;
  @IsOptional() @IsString() actualLandmark?: string | null;
  @IsOptional() @IsString() actualTenure?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) phones?: string[] | null;
  @IsOptional() @IsString() maritalStatus?: string | null;
  @IsOptional() @IsInt() familySize?: number | null;
  @IsOptional() @IsInt() childrenCount?: number | null;
  @IsOptional() @IsString() education?: string | null;
  @IsOptional() @IsString() residenceDuration?: string | null;
  @IsOptional() @IsString() ownsHome?: string | null;
  @IsOptional() @IsString() depositsBand?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CloseContactInput) closeContacts?: CloseContactInput[] | null;
  @IsOptional() @IsString() entrepreneurType?: string | null;
  @IsOptional() @IsString() entrepreneurCertNo?: string | null;
}

export class CloseContactInput {
  @IsOptional() @IsString() relation?: string | null;
  @IsOptional() @IsString() fullName?: string | null;
  @IsOptional() @IsString() phone?: string | null;
}

export class GuarantorInput {
  @IsString() @MinLength(1) fullName!: string;
  @IsOptional() @IsString() passportSeries?: string | null;
  @IsOptional() @IsString() passportNumber?: string | null;
  @IsOptional() @IsString() pinfl?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() relation?: string | null;
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
  @IsOptional() @IsNumber() @Min(0) agreedValue?: number | null;
  @IsOptional() @IsString() agreedValueWords?: string | null;

  // real estate
  @IsOptional() @IsIn(['HOUSE', 'APARTMENT']) realtyKind?: 'HOUSE' | 'APARTMENT' | null;
  @IsOptional() @IsString() address?: string | null;
  @IsOptional() @IsString() registryNo?: string | null;
  @IsOptional() @IsString() propertyType?: string | null;
  @IsOptional() @IsString() cadastreNo?: string | null;
  @IsOptional() @IsString() registrationDate?: string | null;
  @IsOptional() @IsNumber() landAreaM2?: number | null;
  @IsOptional() @IsNumber() totalAreaM2?: number | null;
  @IsOptional() @IsNumber() usableAreaM2?: number | null;
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

export class EmploymentInput {
  @IsOptional() @IsString() employer?: string | null;
  @IsOptional() @IsString() employerAddress?: string | null;
  @IsOptional() @IsString() sector?: string | null;
  @IsOptional() @IsInt() sectorRiskCode?: number | null;
  @IsOptional() @IsString() position?: string | null;
  @IsOptional() @IsString() employedSince?: string | null;
  @IsOptional() @IsString() experienceBand?: string | null;
}

export class AffordabilityInput {
  @IsOptional() @IsNumber() @Min(0) mainActivityIncome?: number | null;
  @IsOptional() @IsNumber() @Min(0) secondaryIncome?: number | null;
  @IsOptional() @IsNumber() @Min(0) familyIncome?: number | null;
  @IsOptional() @IsNumber() @Min(0) otherIncome?: number | null;
  @IsOptional() @IsNumber() @Min(0) utilitiesExpense?: number | null;
  @IsOptional() @IsNumber() @Min(0) familyExpense?: number | null;
  @IsOptional() @IsNumber() @Min(0) otherExpense?: number | null;
  @IsOptional() @IsNumber() @Min(0) existingCreditBurden?: number | null;
  @IsOptional() @IsNumber() @Min(0) newLoanPayment?: number | null;
}

export class InsuranceInput {
  @IsOptional() @IsBoolean() insured?: boolean;
  @IsOptional() @IsString() company?: string | null;
  @IsOptional() @IsString() genAgreementNo?: string | null;
  @IsOptional() @IsString() genAgreementDate?: string | null;
  @IsOptional() @IsString() policyNo?: string | null;
  @IsOptional() @IsString() policyIssueDate?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(600) policyTermMonths?: number | null;
  @IsOptional() @IsString() policyExpiry?: string | null;
  @IsOptional() @IsNumber() @Min(0) loanUnderPolicy?: number | null;
  @IsOptional() @IsNumber() @Min(0) insuredSum?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(5) insuranceRate?: number | null;
  @IsOptional() @IsNumber() @Min(0) premium?: number | null;
}

export class TrancheInput {
  @IsOptional() @IsInt() trancheNo?: number | null;
  @IsOptional() @IsString() applicationNo?: string | null;
  @IsOptional() @IsString() applicationDate?: string | null;
  @IsOptional() @IsString() contractNo?: string | null;
  @IsOptional() @IsString() contractDate?: string | null;
  @IsOptional() @IsNumber() @Min(0) principal?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number | null;
  @IsOptional() @IsString() maturity?: string | null;
  @IsOptional() @IsIn(['ANNUITY', 'DIFFERENTIATED']) scheduleType?: 'ANNUITY' | 'DIFFERENTIATED' | null;
  @IsOptional() @IsNumber() @Min(0) monthlyPayment?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(31) paymentDay?: number | null;
  @IsOptional() @IsNumber() @Min(0) insurancePayment?: number | null;
}

export class CreditLineInput {
  @IsOptional() @IsString() lineNumber?: string | null;
  @IsOptional() @IsIn(['MICROLOAN', 'MICROCREDIT']) loanType?: 'MICROLOAN' | 'MICROCREDIT' | null;
  @IsOptional() @IsNumber() @Min(0) amountAuto?: number | null;
  @IsOptional() @IsNumber() @Min(0) amountPolis?: number | null;
  @IsOptional() @IsNumber() @Min(0) amountTotal?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number | null;
  @IsOptional() @IsString() lineDate?: string | null;
  @IsOptional() @IsString() lineMaturity?: string | null;
  @IsOptional() @IsNumber() @Min(0) @Max(5) interestRate?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(5) penaltyRate?: number | null;
  @IsOptional() @IsString() orderNumber?: string | null;
  @IsOptional() @ValidateNested() @Type(() => InsuranceInput) insurance?: InsuranceInput | null;
  @IsOptional() @ValidateNested() @Type(() => TrancheInput) tranche?: TrancheInput | null;
}

export class CreditHistoryInput {
  @IsOptional() @IsInt() repaidLoansCount?: number | null;
  @IsOptional() @IsInt() activeLoansCount?: number | null;
  @IsOptional() @IsInt() overdueSubstandardFlag?: number | null;
  @IsOptional() @IsInt() otherObligations?: number | null;
  @IsOptional() @IsString() loansOver5MFlag?: string | null;
  @IsOptional() @IsString() priorMfiPawnshopFlag?: string | null;
  @IsOptional() @IsNumber() @Min(0) totalOutstandingDebt?: number | null;
  @IsOptional() @IsNumber() @Min(0) avgMonthlyPaymentExisting?: number | null;
  @IsOptional() @IsString() committeeProtocolRef?: string | null;
  @IsOptional() @IsString() committeeDecisionDate?: string | null;
}

export class UpsertCaseDto {
  @IsOptional() @IsNumber() @Min(0) amount?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number | null;

  @ValidateNested()
  @Type(() => BorrowerInput)
  borrower!: BorrowerInput;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuarantorInput)
  guarantors?: GuarantorInput[];

  // Optional so per-step autosave (which omits sections it isn't saving) validates;
  // the ≥1-collateral requirement is enforced at the submit transition instead.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CollateralInput)
  collaterals?: CollateralInput[];

  @IsOptional() @ValidateNested() @Type(() => EmploymentInput) employment?: EmploymentInput | null;
  @IsOptional() @ValidateNested() @Type(() => AffordabilityInput) affordability?: AffordabilityInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditLineInput) creditLine?: CreditLineInput | null;
  @IsOptional() @ValidateNested() @Type(() => CreditHistoryInput) creditHistory?: CreditHistoryInput | null;
}

export class TransitionDto {
  @IsEnum(WorkflowDecision) decision!: WorkflowDecision;
  @IsOptional() @IsString() comment?: string;
}

export class SetKatmPriceDto {
  @IsNumber() @Min(0) katmPrice!: number;
}

export class SetRateDto {
  @IsNumber() @Min(0) interestRate!: number;
  @IsString() @MinLength(1) reason!: string;
}

export class ReMflSearchDto {
  @IsString() @MinLength(2) term!: string;
}

export class ReMflCreateDto {
  @IsString() @MinLength(1) sourceCaseId!: string;
}

/** Director sets the loan split: property-backed (avto) vs insurance-backed (polis) portions. */
export class SetSplitDto {
  @IsNumber() @Min(0) amountAuto!: number;
  @IsNumber() @Min(0) amountPolis!: number;
  @IsOptional() @IsString() reason?: string;
}

export class CaseSectionDto {
  @IsIn(['borrower', 'employment', 'affordability', 'creditLine', 'creditHistory'])
  section!: 'borrower' | 'employment' | 'affordability' | 'creditLine' | 'creditHistory';

  @ValidateNested() @Type(() => UpsertCaseDto) data!: UpsertCaseDto;
}
