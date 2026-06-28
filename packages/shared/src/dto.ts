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

/** Unified collateral — REAL_ESTATE uses the address/cadastre fields,
 *  AUTO uses the vehicle fields. A case can hold several. */
export interface CollateralDto {
  id?: string;
  type: ProductType;
  agreedValue: number | null;
  agreedValueWords: string | null;
  // real estate
  address?: string | null;
  registryNo?: string | null;
  propertyType?: string | null;
  cadastreNo?: string | null;
  registrationDate?: string | null;
  totalAreaM2?: number | null;
  livingAreaM2?: number | null;
  roomNames?: string | null;
  roomCount?: number | null;
  // auto
  techPassportNo?: string | null;
  techPassportDate?: string | null;
  model?: string | null;
  stateNumber?: string | null;
  bodyType?: string | null;
  bodyNo?: string | null;
  engineNo?: string | null;
  chassis?: string | null;
  color?: string | null;
  year?: number | null;
  mileage?: number | null;
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

export interface GuarantorDto {
  id?: string;
  fullName: string;
  passportSeries: string | null;
  passportNumber: string | null;
  pinfl: string | null;
  phone: string | null;
  relation: string | null;
}

export interface DocumentDto {
  id: string;
  type: DocumentType;
  fileName: string;
  isGenerated: boolean;
  uploadedAt: string;
  uploadedByName: string | null;
  mimeType: string | null;
  url: string;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  role: Role;
  branchName: string | null;
}

export interface MessageDto {
  id: string;
  caseId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  text: string | null;
  toRole: Role | null;
  document: DocumentDto | null;
  mine: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  caseId: string;
  caseNumber: string;
  senderName: string;
  senderRole: Role;
  text: string | null;
  toRole: Role | null;
  hasFile: boolean;
  read: boolean;
  createdAt: string;
}

export interface StatsResponse {
  byStatus: { status: CaseStatus; count: number }[];
  byBranch: { branch: string; count: number }[];
  byProduct: { product: ProductType; count: number; amount: number }[];
  byMonth: { month: string; count: number; amount: number }[];
  totalCases: number;
  totalAmount: number;
  totalKatm: number;
  totalCollateralValue: number;
  avgAmount: number;
  approvalRate: number; // finalized / total, 0..1
  finalizedCount: number;
  activeCount: number; // in-progress (not finalized/rejected)
  recent: CreditCaseListItem[];
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
  guarantors: GuarantorDto[];
  collaterals: CollateralDto[];
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

/** Payload to create or update a case (manual form OR import-confirmed). */
export interface UpsertCasePayload {
  amount: number | null;
  termMonths: number | null;
  borrower: BorrowerDto;
  guarantors: GuarantorDto[];
  collaterals: CollateralDto[];
}

export interface TransitionPayload {
  decision: WorkflowDecision;
  comment?: string;
}

/** Result of parsing an uploaded .xlsx — prefilled, operator confirms. */
export interface ImportParseResult {
  borrower: Partial<BorrowerDto>;
  collateral: Partial<CollateralDto>;
  amount: number | null;
  warnings: string[];
}
