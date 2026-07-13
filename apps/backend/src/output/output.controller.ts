import { ConflictException, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DocumentType, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { CreditCasesService } from '../credit-cases/credit-cases.service';
import { StorageService } from '../documents/storage.service';
import { PdfService } from './pdf.service';
import { exportCaseToExcel } from './excel-export.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('output')
export class OutputController {
  constructor(
    private readonly cases: CreditCasesService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Generate the valuation-act PDF, store it as a GENERATED_PDF document, return it. */
  @Post(':id/pdf/valuation-act')
  async generateValuationAct(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const c = await this.cases.getOne(id);
    if (!c.collaterals.length) throw new ConflictException('Garovsiz arizaga hujjat yaratib bo‘lmaydi');
    const buffer = await this.pdf.valuationAct(c);
    const fileName = `Akt_${c.number}.pdf`;
    const stored = await this.storage.save(buffer, fileName, 'application/pdf', `${id}/generated`);
    await this.prisma.document.create({
      data: {
        caseId: id,
        type: DocumentType.GENERATED_PDF,
        fileName,
        storagePath: stored.storagePath,
        mimeType: 'application/pdf',
        isGenerated: true,
        uploadedById: user.id,
      },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  /** Export the case to .xlsx for download. */
  @Get(':id/excel')
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const c = await this.cases.getOne(id);
    if (!c.collaterals.length) throw new ConflictException('Garovsiz arizani eksport qilib bo‘lmaydi');
    const buffer = await exportCaseToExcel(c);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="Garov_${c.number}.xlsx"`);
    res.send(buffer);
  }
}
