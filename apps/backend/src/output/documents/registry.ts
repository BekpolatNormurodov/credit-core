import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { CaseDocData } from './case-document.loader';
import { contractTemplate } from './templates/contract';
import { petitionTemplate } from './templates/petition';
import { creditApplicationTemplate } from './templates/credit-application';
import { prikazTemplate } from './templates/prikaz';
import { protokolTemplate } from './templates/protokol';
import { scoreReportTemplate } from './templates/score-report';
import { rklGenTemplate } from './templates/rkl-gen';
import { actTemplate } from './templates/act';
import { obloshkaTemplate } from './templates/obloshka';
import { cheklistTemplate } from './templates/cheklist';
import { accountantSplitTemplate } from './templates/accountant-split';
import { monitoringTemplate } from './templates/monitoring';
import { grafikTemplate } from './templates/grafik';
import { disbursementTemplate } from './templates/disbursement';

export type DocTemplate = (c: CaseDocData) => TDocumentDefinitions;

export type DocCategory = 'main' | 'notary' | 'accountant';

/**
 * Stage a document becomes relevant at:
 *  - 'review'   — makes sense as soon as the case leaves DRAFT (still under moderator/director review).
 *  - 'approved' — only makes sense once the director has approved the case (notary copies, monitoring
 *                 acts). Requesting these earlier would hand out documents for a case that isn't final.
 */
export type DocStage = 'review' | 'approved';

export const DOC_REGISTRY: Record<string, { title: string; lang: 'uz' | 'ru'; category: DocCategory; stage: DocStage; build: DocTemplate }> = {
  contract: { title: 'Mikroqarz shartnomasi', lang: 'uz', category: 'main', stage: 'review', build: contractTemplate },
  petition: { title: 'Murojaatnoma (Ходатайство)', lang: 'uz', category: 'main', stage: 'review', build: petitionTemplate },
  creditApplication: { title: 'Kredit arizasi', lang: 'uz', category: 'main', stage: 'review', build: creditApplicationTemplate },
  prikaz: { title: 'Buyruq (Приказ на сделку)', lang: 'uz', category: 'main', stage: 'review', build: prikazTemplate },
  protokol: { title: 'Protokol (Протокол)', lang: 'uz', category: 'main', stage: 'review', build: protokolTemplate },
  scoreReport: { title: 'Score hisoboti (Score отчет)', lang: 'uz', category: 'main', stage: 'review', build: scoreReportTemplate },
  rklGen: { title: 'Bosh kelishuv (РКЛ Ген)', lang: 'uz', category: 'main', stage: 'review', build: rklGenTemplate },
  act: { title: 'Kelishuv akti (Акт согласования)', lang: 'uz', category: 'main', stage: 'review', build: actTemplate },
  obloshka: { title: 'Ish obloshkasi (Обложка)', lang: 'uz', category: 'main', stage: 'review', build: obloshkaTemplate },
  cheklist: { title: 'Hujjatlar ro\'yxati (Чек-лист)', lang: 'uz', category: 'main', stage: 'review', build: cheklistTemplate },
  grafik: { title: 'Тўлов жадвали (график)', lang: 'uz', category: 'main', stage: 'review', build: grafikTemplate },
  // Buxgalteriya uchun — the money-movement documents, grouped into their own section (like notary).
  accountantSplit: { title: 'Mablag\' taqsimoti (Бухгалтерия учун)', lang: 'uz', category: 'accountant', stage: 'review', build: accountantSplitTemplate },
  disbursement: { title: 'Пул ўтказиш аризаси (карта реквизитлари)', lang: 'uz', category: 'accountant', stage: 'review', build: disbursementTemplate },
  // One act per supervision period (months 1-6, 7-12, 13-18); the inspection is at the period's end.
  monitoring1: { title: 'Мониторинг далолатномаси (1-6 ой)', lang: 'uz', category: 'main', stage: 'approved', build: (c) => monitoringTemplate(c, 6) },
  monitoring2: { title: 'Мониторинг далолатномаси (7-12 ой)', lang: 'uz', category: 'main', stage: 'approved', build: (c) => monitoringTemplate(c, 12) },
  monitoring3: { title: 'Мониторинг далолатномаси (13-18 ой)', lang: 'uz', category: 'main', stage: 'approved', build: (c) => monitoringTemplate(c, 18) },
  actNotary: { title: 'Акт согласования (нотариал нусха)', lang: 'uz', category: 'notary', stage: 'approved', build: (c) => actTemplate(c, true) },
  prikazNotary: { title: 'Приказ на сделку (нотариал нусха)', lang: 'uz', category: 'notary', stage: 'approved', build: (c) => prikazTemplate(c, true) },
  rklGenNotary: { title: 'Бош келишув — РКЛ Ген (нотариал нусха)', lang: 'uz', category: 'notary', stage: 'approved', build: (c) => rklGenTemplate(c, true) },
};
