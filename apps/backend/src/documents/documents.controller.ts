import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { DocumentType } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from './storage.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard)
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
    const docType = (Object.values(DocumentType) as string[]).includes(type) ? type : DocumentType.OTHER;
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

  /**
   * Download/view. Accepts the JWT via Authorization header OR `?token=` query
   * param so it can be opened directly in a new browser tab for inline viewing.
   * `?inline=1` renders the file in the browser instead of forcing a download.
   */
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('token') token: string | undefined,
    @Query('inline') inline: string | undefined,
  ) {
    // Auth: header or query token.
    const header = (res.req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    const raw = header || token;
    if (!raw) throw new UnauthorizedException();
    try {
      this.jwt.verify(raw);
    } catch {
      throw new UnauthorizedException();
    }

    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Hujjat topilmadi');
    res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(doc.fileName)}"`,
    );
    this.storage.stream(doc.storagePath).pipe(res);
  }
}
