import { Controller, Get, Header, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DOC_REGISTRY } from '../output/documents/registry';
import type { CaseManifest } from './manifest';

/**
 * The page a printed QR leads to. Deliberately unauthenticated — whoever is holding the paper is
 * the audience, and they have no account.
 *
 * What it answers is narrow: was this set of documents signed, by which organisation, and when.
 * It shows no personal or commercial data — no borrower name, PINFL, passport, amount or
 * collateral. Anyone can reach this URL by guessing an id, so nothing here may be worth guessing
 * for. The document in the reader's hand already carries the details; this page only corroborates
 * that it was issued.
 */
@Controller('v')
export class VerifyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':caseId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // Nothing here should be cached by an intermediary — a revoked case must stop verifying at once.
  @Header('Cache-Control', 'no-store')
  async verify(@Param('caseId') caseId: string): Promise<string> {
    const c = await this.prisma.creditCase.findUnique({
      where: { id: caseId },
      select: {
        contractNumber: true, number: true, status: true, signedAt: true, deletedAt: true,
        signature: { select: { manifest: true, manifestSha256: true, verified: true, createdAt: true } },
      },
    });

    // A deleted case stops verifying, and an unsigned one never started. Both get the same answer:
    // saying which it was would leak whether an id exists at all.
    if (!c || c.deletedAt || !c.signature) return page(notFoundBody());

    const org = (c.signature.manifest as unknown as CaseManifest)?.org;
    const docs = (c.signature.manifest as unknown as CaseManifest)?.docs ?? [];

    return page(`
      <h1>Ҳужжат имзоланган</h1>
      <dl>
        ${row('Шартнома рақами', c.contractNumber ?? c.number)}
        ${row('Ташкилот', org?.name ?? '—')}
        ${row('ИНН', org?.inn ?? '—')}
        ${row('Имзо санаси', c.signedAt ? c.signedAt.toLocaleDateString('ru-RU') : '—')}
        ${row('Ҳужжатлар сони', String(docs.length))}
      </dl>

      <p class="note">
        Имзо ушбу тизимда сақланади ва учинчи томон уни E-IMZO сервери орқали текшира олади.
        Тизимнинг ўзи имзони текширмайди${c.signature.verified ? '' : ' — қуйидаги рўйхат ҳужжат ўзгармаганини кўрсатади'}.
      </p>

      <h2>Имзоланган ҳужжатлар</h2>
      <table>
        <thead><tr><th>Ҳужжат</th><th>SHA-256</th></tr></thead>
        <tbody>
          ${docs
            .map(
              (d) =>
                `<tr><td>${esc(DOC_REGISTRY[d.key]?.title ?? d.key)}</td><td class="hash">${esc(d.sha256)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    `);
  }
}

const notFoundBody = () => `
  <h1 class="bad">Ҳужжат топилмади</h1>
  <p class="note">
    Бу ҳавола бўйича имзоланган ҳужжат мавжуд эмас. QR кодни қайта сканерланг ёки ҳужжатни
    берган ташкилотга мурожаат қилинг.
  </p>
`;

/**
 * HTML escaping. Everything interpolated below comes from our own database, but the manifest is a
 * JSON column and document keys reach this page as text — escaping here costs nothing and removes
 * the need to reason about which of them could ever contain a bracket.
 */
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const row = (label: string, value: string) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;

/** Self-contained: a phone scanning this on mobile data should not wait on a font or a stylesheet. */
const page = (body: string) => `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ҳужжатни текшириш</title>
<style>
  :root { color-scheme: light dark; --fg:#0f172a; --muted:#475569; --line:#cbd5e1; --bg:#fff; }
  @media (prefers-color-scheme: dark) { :root { --fg:#e2e8f0; --muted:#94a3b8; --line:#334155; --bg:#0f172a; } }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg);
         font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; }
  h1 { font-size:20px; margin:0 0 16px; }
  h1.bad { color:#dc2626; }
  h2 { font-size:15px; margin:24px 0 8px; }
  dl { margin:0; border-top:1px solid var(--line); }
  dl > div { display:flex; justify-content:space-between; gap:16px;
             padding:9px 0; border-bottom:1px solid var(--line); }
  dt { color:var(--muted); }
  dd { margin:0; text-align:right; font-weight:600; }
  .note { color:var(--muted); font-size:13px; margin:16px 0 0; }
  table { width:100%; border-collapse:collapse; font-size:13px; display:block; overflow-x:auto; }
  th, td { text-align:left; padding:7px 8px 7px 0; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; }
  .hash { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px;
          color:var(--muted); word-break:break-all; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
