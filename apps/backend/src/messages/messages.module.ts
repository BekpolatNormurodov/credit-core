import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { DocumentType, MessageDto, Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../auth/current-user.decorator';
import { StorageService } from '../documents/storage.service';

const msgInclude = {
  sender: true,
  document: { include: { uploadedBy: true } },
  attachments: { include: { uploadedBy: true } },
} as const;

/**
 * A message is visible to: its sender, the user it was directed to (toUserId),
 * everyone (toUserId & toRole both null), or the targeted role (toRole).
 * Directed messages (to a user or role) stay private to those parties.
 */
function visibleTo(user: RequestUser): Prisma.MessageWhereInput {
  return {
    OR: [
      { senderId: user.id },
      { toUserId: user.id },
      { AND: [{ toUserId: null }, { toRole: null }] },
      { AND: [{ toUserId: null }, { toRole: user.role as Role }] },
    ],
  };
}

function docDto(d: any) {
  return {
    id: d.id,
    type: d.type,
    fileName: d.fileName,
    isGenerated: d.isGenerated,
    uploadedAt: d.createdAt.toISOString(),
    uploadedByName: d.uploadedBy?.fullName ?? null,
    mimeType: d.mimeType ?? null,
    url: `/api/documents/${d.id}/download`,
  };
}

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
      where: { AND: [{ senderId: { not: user.id } }, visibleTo(user)] },
      include: { sender: true, case: { select: { number: true } }, document: true, attachments: true },
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
      hasFile: !!m.documentId || m.attachments.length > 0,
      read: (m.readBy ?? '').split(',').includes(user.id),
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Unread message count across the current user's cases (for the sidebar badge). */
  @Get('messages/unread')
  async unread(@CurrentUser() user: RequestUser) {
    const msgs = await this.prisma.message.findMany({
      where: { AND: [{ senderId: { not: user.id } }, visibleTo(user)] },
      select: { id: true, readBy: true, caseId: true },
    });
    const count = msgs.filter((m) => !(m.readBy ?? '').split(',').includes(user.id)).length;
    return { count };
  }

  @Get('cases/:id/messages')
  async list(@Param('id') caseId: string, @CurrentUser() user: RequestUser): Promise<MessageDto[]> {
    const messages = await this.prisma.message.findMany({
      where: { AND: [{ caseId }, visibleTo(user)] },
      include: msgInclude,
      orderBy: { createdAt: 'asc' },
    });

    // Resolve directed-to user names (toUserId has no relation, look up in bulk).
    const targetIds = [...new Set(messages.map((m) => m.toUserId).filter(Boolean) as string[])];
    const targets = targetIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(targets.map((t) => [t.id, t.fullName]));

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

    return messages.map((m) => {
      const docs = [...(m.document ? [m.document] : []), ...m.attachments];
      return {
        id: m.id,
        caseId: m.caseId,
        senderId: m.senderId,
        senderName: m.sender.fullName,
        senderRole: m.sender.role,
        text: m.text,
        toRole: m.toRole,
        toUserId: m.toUserId,
        toUserName: m.toUserId ? nameById.get(m.toUserId) ?? null : null,
        mine: m.senderId === user.id,
        document: m.document ? docDto(m.document) : null,
        documents: docs.map(docDto),
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  @Post('cases/:id/messages')
  @UseInterceptors(FilesInterceptor('files', 3))
  async send(
    @Param('id') caseId: string,
    @CurrentUser() user: RequestUser,
    @Body('text') text: string | undefined,
    @Body('toRole') toRole: string | undefined,
    @Body('toUserId') toUserId: string | undefined,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const created = await this.prisma.message.create({
      data: {
        caseId,
        senderId: user.id,
        text: text || null,
        toRole: toRole ? (toRole as Role) : null,
        toUserId: toUserId || null,
        readBy: user.id,
      },
    });

    if (files?.length) {
      await Promise.all(
        files.map(async (file) => {
          const stored = await this.storage.save(file.buffer, file.originalname, file.mimetype, `${caseId}/chat`);
          await this.prisma.document.create({
            data: {
              caseId,
              messageId: created.id,
              type: DocumentType.CHAT,
              fileName: stored.fileName,
              storagePath: stored.storagePath,
              mimeType: stored.mimeType,
              uploadedById: user.id,
            },
          });
        }),
      );
    }
    return { id: created.id };
  }
}

@Module({ controllers: [MessagesController] })
export class MessagesModule {}
