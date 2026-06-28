import { CaseStatus, DocumentType, ProductType, Role, WorkflowDecision } from './enums';

export interface AuthUser {
  id: string;
  fullName: string;
  login: string;
  role: Role;
  branchId: string | null;
  branch?: BranchDto | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface BranchDto {
  id: string;
  name: string;
  symbol: string;
  region: string | null;
}

export interface CollateralOwnerDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  sharePercent: number | null;
}

export interface RealEstateCollateralDto {
  id?: string;
  address: string;
  registryNo: string | null; // № реестра
  propertyType: string | null; // вид имущества
  cadastreNo: string | null; // № кадастра
  registrationDate: string | null; // ko'chirma / sana
  totalAreaM2: number | null;
  livingAreaM2: number | null;
  roomNames: string | null; // хоналар номи
  roomCount: number | null;
  agreedValue: number | null; // согласованная залоговая стоимость
  agreedValueWords: string | null; // прописью
  owners: CollateralOwnerDto[];
}

export interface BorrowerDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
}

export interface DocumentDto {
  id: string;
  type: DocumentType;
  fileName: string;
  isGenerated: boolean;
  uploadedAt: string;
  url: string;
}

export interface WorkflowEventDto {
  id: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus;
  decision: WorkflowDecision;
  actorName: string;
  role: Role;
  comment: string | null;
  createdAt: string;
}

export interface CreditCaseDto {
  id: string;
  number: string;
  productType: ProductType;
  status: CaseStatus;
  amount: number | null;
  termMonths: number | null;
  katmPrice: number | null;
  branch: BranchDto | null;
  createdByName: string;
  borrower: BorrowerDto | null;
  realEstate: RealEstateCollateralDto | null;
  documents: DocumentDto[];
  events: WorkflowEventDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreditCaseListItem {
  id: string;
  number: string;
  productType: ProductType;
  status: CaseStatus;
  amount: number | null;
  borrowerName: string | null;
  branchSymbol: string | null;
  updatedAt: string;
}

/** Payload to create or update a real-estate case (manual form OR import-confirmed). */
export interface UpsertRealEstateCasePayload {
  amount: number | null;
  termMonths: number | null;
  borrower: BorrowerDto;
  realEstate: RealEstateCollateralDto;
}

export interface TransitionPayload {
  decision: WorkflowDecision;
  comment?: string;
}

/** Result of parsing an uploaded .xlsx — prefilled, operator confirms. */
export interface ImportParseResult {
  borrower: Partial<BorrowerDto>;
  realEstate: Partial<RealEstateCollateralDto>;
  amount: number | null;
  warnings: string[];
}
