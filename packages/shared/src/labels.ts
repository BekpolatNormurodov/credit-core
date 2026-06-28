import { CaseStatus, DocumentType, ProductType, Role } from './enums';

/** Uzbek UI labels (primary language). */
export const ROLE_LABEL: Record<Role, string> = {
  [Role.OPERATOR]: 'Operator',
  [Role.MODERATOR]: 'Moderator',
  [Role.DIRECTOR]: 'Direktor',
  [Role.ADMIN]: 'Administrator',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'Qoralama',
  [CaseStatus.MODERATION]: 'Moderatsiyada',
  [CaseStatus.DIRECTOR_REVIEW]: 'Direktor ko‘rigida',
  [CaseStatus.ADMIN_FINALIZE]: 'Yakunlash (admin)',
  [CaseStatus.FINALIZED]: 'Yakunlangan',
  [CaseStatus.REJECTED]: 'Rad etilgan',
};

export const PRODUCT_LABEL: Record<ProductType, string> = {
  [ProductType.REAL_ESTATE]: 'Uy-joy (ko‘chmas mulk)',
  [ProductType.AUTO]: 'Avtotransport',
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  [DocumentType.NOTARY]: 'Notarial hujjat',
  [DocumentType.SCAN]: 'Skan',
  [DocumentType.COLLATERAL_PHOTO]: 'Garov rasmi',
  [DocumentType.TECH_PASSPORT]: 'Texnik pasport',
  [DocumentType.DIRECTOR_FINAL]: 'Yakuniy hujjat (direktor)',
  [DocumentType.GENERATED_PDF]: 'Generatsiya qilingan PDF',
  [DocumentType.OTHER]: 'Boshqa',
};
