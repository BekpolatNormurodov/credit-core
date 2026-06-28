import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentType } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from './storage.service';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('caseId') caseId: string,
    @Query('type') type: DocumentType,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException('Fayl yuborilmadi');
    if (!caseId) throw new BadRequestException('caseId kerak');
    const docType = (Object.values(DocumentType) as string[]).includes(type)
      ? type
      : DocumentType.OTHER;

    const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype, caseId);
    return this.prisma.document.create({
      data: {
        caseId,
        type: docType as DocumentType,
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
        uploadedById: user.id,
      },
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.fileName)}"`,
    );
    this.storage.stream(doc.storagePath).pipe(res);
  }
}
