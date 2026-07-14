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

export type DocCategory = 'main' | 'notary';

export const DOC_REGISTRY: Record<string, { title: string; lang: 'uz' | 'ru'; category: DocCategory; build: DocTemplate }> = {
  contract: { title: 'Mikroqarz shartnomasi', lang: 'uz', category: 'main', build: contractTemplate },
  petition: { title: 'Murojaatnoma (Ходатайство)', lang: 'uz', category: 'main', build: petitionTemplate },
  creditApplication: { title: 'Kredit arizasi', lang: 'uz', category: 'main', build: creditApplicationTemplate },
  prikaz: { title: 'Buyruq (Приказ на сделку)', lang: 'uz', category: 'main', build: prikazTemplate },
  protokol: { title: 'Protokol (Протокол)', lang: 'uz', category: 'main', build: protokolTemplate },
  scoreReport: { title: 'Score hisoboti (Score отчет)', lang: 'uz', category: 'main', build: scoreReportTemplate },
  rklGen: { title: 'Bosh kelishuv (РКЛ Ген)', lang: 'uz', category: 'main', build: rklGenTemplate },
  act: { title: 'Kelishuv akti (Акт согласования)', lang: 'uz', category: 'main', build: actTemplate },
  obloshka: { title: 'Ish obloshkasi (Обложка)', lang: 'uz', category: 'main', build: obloshkaTemplate },
  cheklist: { title: 'Hujjatlar ro\'yxati (Чек-лист)', lang: 'uz', category: 'main', build: cheklistTemplate },
  accountantSplit: { title: 'Mablag\' taqsimoti (Бухгалтерия учун)', lang: 'uz', category: 'main', build: accountantSplitTemplate },
  grafik: { title: 'Тўлов жадвали (график)', lang: 'uz', category: 'main', build: grafikTemplate },
  disbursement: { title: 'Пул ўтказиш аризаси', lang: 'uz', category: 'main', build: disbursementTemplate },
  monitoring1: { title: 'Мониторинг далолатномаси (бошланғич)', lang: 'uz', category: 'main', build: (c) => monitoringTemplate(c, 0) },
  monitoring2: { title: 'Мониторинг далолатномаси (6 ой)', lang: 'uz', category: 'main', build: (c) => monitoringTemplate(c, 6) },
  monitoring3: { title: 'Мониторинг далолатномаси (12 ой)', lang: 'uz', category: 'main', build: (c) => monitoringTemplate(c, 12) },
  actNotary: { title: 'Акт согласования (нотариал нусха)', lang: 'uz', category: 'notary', build: (c) => actTemplate(c, true) },
  prikazNotary: { title: 'Приказ на сделку (нотариал нусха)', lang: 'uz', category: 'notary', build: (c) => prikazTemplate(c, true) },
  rklGenNotary: { title: 'Бош келишув — РКЛ Ген (нотариал нусха)', lang: 'uz', category: 'notary', build: (c) => rklGenTemplate(c, true) },
};
