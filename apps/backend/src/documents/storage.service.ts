import { Injectable } from '@nestjs/common';
import { promises as fs, createReadStream, ReadStream } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';

/**
 * Storage abstraction. LocalDiskStorage is used now (no Docker/S3).
 * Swap for an S3/MinIO implementation later without touching callers.
 */
export interface StoredFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly root = resolve(process.env.UPLOAD_DIR ?? './uploads');

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  async save(buffer: Buffer, originalName: string, mimeType: string, subdir = ''): Promise<StoredFile> {
    const dir = join(this.root, subdir);
    await this.ensureDir(dir);
    const safe = originalName.replace(/[^\w.\-а-яА-ЯёЁ ]+/g, '_');
    const key = `${randomUUID()}__${safe}`;
    const fullPath = join(dir, key);
    await fs.writeFile(fullPath, buffer);
    return { storagePath: join(subdir, key), fileName: originalName, mimeType };
  }

  resolvePath(storagePath: string): string {
    return join(this.root, storagePath);
  }

  stream(storagePath: string): ReadStream {
    return createReadStream(this.resolvePath(storagePath));
  }
}
