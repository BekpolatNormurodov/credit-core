import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentType, MessageDto, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';

const msgInclude = { sender: true, document: { include: { uploadedBy: true } } } as const;

@UseGuards(JwtAuthGuard)
@Controller()
class MessagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Directory search — any authenticated user can look up colleagues by role/name. */
  @Get('directory')
  async directory(@Query('role') role?: string, @Query('q') q?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: role ? (role as Role) : undefined,
        fullName: q ? { contains: q } : undefined,
      },
      select: { id: true, fullName: true, role: true, branch: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
      take: 30,
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      branchName: u.branch?.name ?? null,
    }));
  }

  /** Notification feed — recent messages from others, newest first. */
  @Get('messages/feed')
  async feed(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { senderId: { not: user.id } },
      include: { sender: true, case: { select: { number: true } }, document: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return msgs.map((m) => ({
      id: m.id,
      caseId: m.caseId,
      caseNumber: m.case.number,
      senderName: m.sender.fullName,
      senderRole: m.sender.role,
      text: m.text,
      toRole: m.toRole,
      hasFile: !!m.documentId,
      read: (m.readBy ?? '').split(',').includes(user.id),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Unread message count across the current user's cases (for the sidebar badge). */
  @Get('messages/unread')
  async unread(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { senderId: { not: user.id } },
      select: { id: true, readBy: true, caseId: true },
    });
    const count = msgs.filter((m) => !(m.readBy ?? '').split(',').includes(user.id)).length;
    return { count };
  }

  @Get('cases/:id/messages')
  async list(@Param('id') caseId: string, @CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: { caseId },
      include: msgInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread (not mine) as read by me.
    const toMark = messages.filter(
      (m) => m.senderId !== user.id && !(m.readBy ?? '').split(',').includes(user.id),
    );
    if (toMark.length) {
      await Promise.all(
        toMark.map((m) =>
          this.prisma.message.update({
            where: { id: m.id },
            data: { readBy: [...(m.readBy ?? '').split(',').filter(Boolean), user.id].join(',') },
          }),
        ),
      );
    }

    return messages.map((m) => ({
      id: m.id,
      caseId: m.caseId,
      senderId: m.senderId,
      senderName: m.sender.fullName,
      senderRole: m.sender.role,
      text: m.text,
      toRole: m.toRole,
      mine: m.senderId === user.id,
      document: m.document
        ? {
            id: m.document.id,
            type: m.document.type,
            fileName: m.document.fileName,
            isGenerated: m.document.isGenerated,
            uploadedAt: m.document.createdAt.toISOString(),
            uploadedByName: m.document.uploadedBy?.fullName ?? null,
            mimeType: m.document.mimeType,
            url: `/api/documents/${m.document.id}/download`,
          }
        : null,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  @Post('cases/:id/messages')
  @UseInterceptors(FileInterceptor('file'))
  async send(
    @Param('id') caseId: string,
    @CurrentUser() user: RequestUser,
    @Body('text') text: string | undefined,
    @Body('toRole') toRole: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let documentId: string | undefined;
    if (file) {
      const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype, `${caseId}/chat`);
      const doc = await this.prisma.document.create({
        data: {
          caseId,
          type: DocumentType.CHAT,
          fileName: stored.fileName,
          storagePath: stored.storagePath,
          mimeType: stored.mimeType,
          uploadedById: user.id,
        },
      });
      documentId = doc.id;
    }
    const created = await this.prisma.message.create({
      data: {
        caseId,
        senderId: user.id,
        text: text || null,
        toRole: toRole ? (toRole as Role) : null,
        documentId,
        readBy: user.id,
      },
    });
    return { id: created.id };
  }
}

@Module({ controllers: [MessagesController] })
export class MessagesModule {}
