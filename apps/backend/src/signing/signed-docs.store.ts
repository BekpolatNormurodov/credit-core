import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

/**
 * Where a signed case's frozen documents live.
 *
 * Once the director signs, these files *are* the issued documents — the templates are no longer
 * consulted for that case. Editing the case data afterwards can never rewrite a document that was
 * already signed, which is the whole point: the signature is over these exact bytes.
 *
 * Mirrors StorageService's UPLOAD_DIR convention so a deploy that already persists uploads gets
 * this for free.
 */
@Injectable()
export class SignedDocsStore {
  private readonly root = resolve(process.env.UPLOAD_DIR ?? './uploads', 'signed-docs');

  /**
   * A case id is a cuid, but it arrives from the URL — reject anything that could escape the
   * directory rather than trusting the router to have validated it.
   */
  private dirFor(caseId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(caseId)) throw new Error(`unsafe case id: ${caseId}`);
    return join(this.root, caseId);
  }

  /** Registry keys are ours, but the same argument applies — this one reaches the filesystem. */
  private fileFor(caseId: string, key: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error(`unsafe document key: ${key}`);
    return join(this.dirFor(caseId), `${key}.pdf`);
  }

  fileName(key: string): string {
    return `${key}.pdf`;
  }

  async write(caseId: string, key: string, pdf: Buffer): Promise<void> {
    await fs.mkdir(this.dirFor(caseId), { recursive: true });
    await fs.writeFile(this.fileFor(caseId, key), pdf);
  }

  /** null when the file is absent — callers treat that as "not frozen", never as an error. */
  async read(caseId: string, key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.fileFor(caseId, key));
    } catch {
      return null;
    }
  }

  /**
   * Drop the whole set. Used when a signing attempt fails: a frozen-but-unsigned set is a
   * document that looks issued and is not, and it must not be left lying in the store.
   */
  async removeAll(caseId: string): Promise<void> {
    try {
      await fs.rm(this.dirFor(caseId), { recursive: true, force: true });
    } catch {
      /* already gone — tidying up must not become an error the director sees */
    }
  }
}
