import { Controller, Get, Param, Query, Res, UseGuards, NotFoundException, ConflictException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PdfService } from './pdf.service';
import { loadCaseForDocs } from './documents/case-document.loader';
import { watermarkForStatus } from './documents/doc-layout';
import { DOC_REGISTRY } from './documents/registry';

@UseGuards(JwtAuthGuard)
@Controller('cases/:id/documents')
export class CaseDocumentsController {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}

  @Get()
  async list(@Param('id') id: string) {
    const c = await this.prisma.creditCase.findUnique({ where: { id }, select: { status: true } });
    if (!c) throw new NotFoundException('case not found');
    const available = c.status !== 'DRAFT';
    const wm = watermarkForStatus(c.status);
    return Object.entries(DOC_REGISTRY).map(([key, d]) => ({
      key,
      title: d.title,
      lang: d.lang,
      available,
      watermarked: available && wm !== null,
    }));
  }

  @Get(':key/pdf')
  async getPdf(
    @Param('id') id: string,
    @Param('key') key: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const tpl = DOC_REGISTRY[key];
    if (!tpl) throw new NotFoundException('unknown document');
    const c = await loadCaseForDocs(this.prisma, id);
    if (!c) throw new NotFoundException('case not found');
    if (c.status === 'DRAFT') throw new ConflictException('hujjat hali mavjud emas (qoralama)');

    const def = tpl.build(c);
    const wm = watermarkForStatus(c.status);
    if (wm) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (def as any).watermark = { text: wm, opacity: 0.12, angle: -40, bold: true };
    }

    const buffer = await this.pdf.render(def);
    const fileName = `${key}_${c.number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download === '1' ? 'attachment' : 'inline'}; filename="${fileName}"`);
    res.send(buffer);
  }
}
