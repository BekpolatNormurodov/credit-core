import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { CaseDocData } from './case-document.loader';
import { contractTemplate } from './templates/contract';
import { petitionTemplate } from './templates/petition';
import { creditApplicationTemplate } from './templates/credit-application';
import { prikazTemplate } from './templates/prikaz';
import { protokolTemplate } from './templates/protokol';
import { scoreReportTemplate } from './templates/score-report';

export type DocTemplate = (c: CaseDocData) => TDocumentDefinitions;

export const DOC_REGISTRY: Record<string, { title: string; lang: 'uz' | 'ru'; build: DocTemplate }> = {
  contract: { title: 'Mikroqarz shartnomasi', lang: 'uz', build: contractTemplate },
  petition: { title: 'Murojaatnoma (Ходатайство)', lang: 'uz', build: petitionTemplate },
  creditApplication: { title: 'Kredit arizasi', lang: 'uz', build: creditApplicationTemplate },
  prikaz: { title: 'Buyruq (Приказ на сделку)', lang: 'uz', build: prikazTemplate },
  protokol: { title: 'Protokol (Протокол)', lang: 'uz', build: protokolTemplate },
  scoreReport: { title: 'Score hisoboti (Score отчет)', lang: 'uz', build: scoreReportTemplate },
};
