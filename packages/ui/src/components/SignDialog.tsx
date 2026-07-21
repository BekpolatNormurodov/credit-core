import { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '@credit-core/api-client';
import { Check, Key, ShieldOff } from '../lib/icons';
import { Modal } from './Modal';
import { Button, Field } from './primitives';
import { Select, type Option } from './forms';
import {
  probeEimzo, loadKey, createPkcs7, unloadKey, innFromAlias, EimzoError,
  type EimzoKey, type EimzoStatus,
} from '../lib/eimzo';

/**
 * Director signing with an E-IMZO key.
 *
 * Ported from the spravka project's rahbar SignDialog, where this exact flow is in production
 * use. The wording, the stepper and the two distinct failure states are kept as they are because
 * each of them came out of a real failure there — see the comments below.
 */

/** What the director is waiting on. Signing is several seconds and several steps — say which. */
type Step = null | 'preparing' | 'unlocking' | 'signing' | 'saving';

/** A spinner sized for inline use, matching Button's. */
function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`${className} animate-spin rounded-full border-2 border-current border-t-transparent`} />;
}

/**
 * 'C:\' + 'DSKEYS' → 'C:\DSKEYS'. E-IMZO hands `disk` back with its separator already attached,
 * so appending another one printed 'C:\\DSKEYS'.
 *
 * The separator is whatever the *signer's* machine uses, not ours: E-IMZO ships for Linux and
 * macOS too, where a key lives under something like '/home/user' and a backslash would be
 * nonsense. Take it from the value rather than assuming Windows.
 */
function keyLocation(k: EimzoKey): string {
  // A key may sit in the drive root — E-IMZO allows an empty path — and 'E:' is not the root,
  // 'E:\' is.
  if (!k.path) return k.disk;
  // A drive letter means Windows even when the separator was trimmed off ('D:').
  const windows = k.disk.includes('\\') || /^[A-Za-z]:/.test(k.disk);
  const sep = windows ? '\\' : '/';
  return `${k.disk.replace(/[\\/]+$/, '')}${sep}${k.path}`;
}

/**
 * E-IMZO reports a closed password window as an error («Ввод пароля отменен»). It is not one —
 * the director chose to stop — and showing it in red as a failure would say something went wrong
 * when nothing did. Matched on E-IMZO's own wording in both languages it uses.
 */
const isCancelled = (m: string) => /отмен|bekor|cancel/i.test(m);

/** In order. The stepper walks this, so it is also the definition of "what happens next". */
const STEPS: { key: NonNullable<Step>; label: string; done: string }[] = [
  { key: 'preparing', label: 'Hujjatlar tayyorlanmoqda', done: 'Hujjatlar tayyor' },
  { key: 'unlocking', label: 'Parol kutilmoqda', done: 'Kalit ochildi' },
  { key: 'signing', label: 'Imzolanmoqda', done: 'Imzolandi' },
  { key: 'saving', label: 'Saqlanmoqda', done: 'Saqlandi' },
];

/**
 * Where the signing has got to.
 *
 * Worth the space because of what spravka's logs showed: two real attempts died at «Ввод пароля
 * отменен» — the password window opens as a separate desktop window, lands behind the browser,
 * and the signer never sees it. A single line saying "signing…" gives them nothing to act on.
 * So the waiting-on-you step says so, in its own words, and the rest of the list makes it
 * obvious that the system is waiting rather than stuck.
 */
function SignProgress({ current }: { current: NonNullable<Step> }) {
  const at = STEPS.findIndex((s) => s.key === current);

  return (
    <ol aria-live="polite">
      {STEPS.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'active' : 'todo';
        const last = i === STEPS.length - 1;
        return (
          <li key={s.key} className="flex gap-3">
            {/* Rail + marker. Never colour alone: done is a tick, active spins, todo is a ring. */}
            <div className="flex flex-col items-center">
              <span className="grid h-5 w-5 shrink-0 place-items-center" aria-hidden>
                {state === 'done' && <span className="text-emerald-600 dark:text-emerald-400"><Check size={18} /></span>}
                {state === 'active' && <span className="text-brand-600 dark:text-brand-400"><Spinner /></span>}
                {state === 'todo' && <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
              </span>
              {/* The line is what turns four labels into a sequence. Filled behind, faint ahead. */}
              {!last && (
                <span
                  className={`w-px flex-1 ${i < at ? 'bg-emerald-600/40 dark:bg-emerald-400/40' : 'bg-slate-200 dark:bg-slate-700'}`}
                  aria-hidden
                />
              )}
            </div>
            <span
              className={`pb-3 text-sm ${
                state === 'active' ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
              } ${last ? 'pb-0' : ''}`}
            >
              {state === 'done' ? s.done : s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SignDialog({
  open,
  onClose,
  caseId,
  contractNumber,
  borrowerName,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  contractNumber: string;
  borrowerName: string;
  onSigned: () => void;
}) {
  const [status, setStatus] = useState<EimzoStatus>('checking');
  const [keys, setKeys] = useState<EimzoKey[]>([]);
  const [alias, setAlias] = useState('');
  const [step, setStep] = useState<Step>(null);
  const [err, setErr] = useState('');
  const [denyReason, setDenyReason] = useState('');
  /** The INN the key must carry. null while loading, or if the org has none configured. */
  const [required, setRequired] = useState<{ orgName: string | null; inn: string | null } | null>(null);

  const probe = useCallback(async () => {
    setStatus('checking');
    setErr('');
    setDenyReason('');
    // Which key is acceptable is the server's answer, not a constant here — and it is needed
    // before the picker renders, so the wrong key is never offered rather than rejected later.
    const req = await api.signKeyRequirement(caseId).catch(() => null);
    setRequired(req);
    const r = await probeEimzo();
    if (r.status === 'ready') {
      setKeys(r.keys);
      // Preselect only when there is exactly one key the firm may actually sign with.
      const usable = req?.inn ? r.keys.filter((k) => innFromAlias(k.alias) === req.inn) : r.keys;
      setAlias(usable.length === 1 ? usable[0]!.alias : '');
    } else if (r.status === 'domain-denied') {
      setDenyReason(r.reason);
    }
    setStatus(r.status);
  }, [caseId]);

  useEffect(() => {
    if (open) void probe();
  }, [open, probe]);

  async function sign() {
    const key = keys.find((k) => k.alias === alias);
    if (!key) return;
    setErr('');
    let keyId: string | null = null;
    let challengeId: string | null = null;

    /*
      The stage is tracked here as well as in state, and the local is what the failure report
      uses. `step` is a closure over the render that started this call, so it reads `null` in the
      catch no matter how far we actually got — spravka's log said "stage: unknown" for every
      failure, which is precisely the field worth having.
    */
    let stage: NonNullable<Step> = 'preparing';
    const at = (s: NonNullable<Step>) => {
      stage = s;
      setStep(s);
    };

    try {
      // 1. The server renders and freezes the document set, then tells us exactly which bytes to
      //    sign. It keeps the digest, so a signature can never be filed against bytes it does
      //    not cover.
      at('preparing');
      const prep = await api.signPrepare(caseId);
      challengeId = prep.challengeId;

      // 2. E-IMZO opens its own password window. Nothing about it is ours — which is precisely
      //    why the password never reaches this page.
      at('unlocking');
      keyId = await loadKey(key);

      at('signing');
      const pkcs7 = await createPkcs7(prep.manifestBase64, keyId);

      // 3. Only the finished signature crosses back.
      at('saving');
      await api.signCommit(caseId, {
        challengeId: prep.challengeId,
        pkcs7,
        signerInfo: { alias: key.alias, name: key.name, disk: key.disk },
      });

      onSigned();
    } catch (e) {
      const raw = e instanceof EimzoError ? e.message : getErrorMessage(e);
      const message = isCancelled(raw)
        ? 'Parol kiritilmadi — imzolash bekor qilindi. Qaytadan urinib ko‘ring.'
        : raw;
      setErr(message);

      // Tell the server it failed. Nothing is written to the case; only the attempt is recorded,
      // and the challenge is dropped so the frozen-but-unsigned documents cannot be completed
      // later.
      //
      // `raw`, not `message`: the log gets E-IMZO's own words. The softened wording above is for
      // the director; rewriting it in the log would hide what actually happened from whoever has
      // to diagnose it.
      void api.signError(caseId, { challengeId, stage, error: raw }).catch(() => {
        /* reporting a failure must not itself become a failure the director sees */
      });
    } finally {
      if (keyId) void unloadKey(keyId);
      setStep(null);
    }
  }

  const busy = step !== null;
  // Only the firm's own key may sign. Keys belonging to a person or another company are dropped
  // from the list entirely rather than shown and refused — the director cannot act on a key that
  // is not theirs to use, so offering it only invites a wasted password.
  const usableKeys = required?.inn ? keys.filter((k) => innFromAlias(k.alias) === required.inn) : keys;
  const rejectedCount = keys.length - usableKeys.length;
  const keyOptions: Option<string>[] = usableKeys.map((k) => ({
    value: k.alias,
    label: `${k.name} — ${keyLocation(k)}`,
  }));

  return (
    <Modal
      open={open}
      title="Arizani imzolash"
      description="Imzolangandan keyin hujjatlarni tahrirlab ham, imzoni qaytarib ham bo‘lmaydi."
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor
          </Button>
          <Button
            variant="primary"
            disabled={status !== 'ready' || !alias}
            loading={busy}
            onClick={() => void sign()}
          >
            {!busy && <Key className="h-5 w-5" />} {busy ? 'Imzolanmoqda…' : 'Imzolash'}
          </Button>
        </>
      }
    >
      {err && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
          {err}
        </p>
      )}

      {/* Bordered, not filled — same contrast reason as the stepper below. */}
      <dl className="space-y-1.5 rounded-xl border border-hairline px-4 py-3 text-sm dark:border-white/10">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Shartnoma</dt>
          <dd className="font-mono tabular-nums">{contractNumber}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Qarz oluvchi</dt>
          <dd className="text-right font-medium">{borrowerName}</dd>
        </div>
      </dl>

      {/*
        Once it is running, the picker and the notices are answered questions — the director's
        only job left is the password window. Swap them for the stepper rather than stacking it
        under a dialog full of choices they have already made.
      */}
      {busy && (
        <div className="mt-4 rounded-xl border border-hairline px-4 py-3 dark:border-white/10">
          <SignProgress current={step!} />

          {/* The step that actually loses people — say where to look. */}
          {step === 'unlocking' && (
            <p className="mt-2 border-t border-hairline pt-2.5 text-xs leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
              E-IMZO parol oynasini <b className="text-slate-900 dark:text-slate-100">alohida oyna</b> qilib
              ochadi — u brauzer ortida qolib ketishi mumkin. Ko‘rinmasa, vazifalar panelidan E-IMZO ni toping.
            </p>
          )}
        </div>
      )}

      <div className={busy ? 'hidden' : 'mt-4'}>
        {status === 'checking' && (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner /> E-IMZO tekshirilmoqda…
          </p>
        )}

        {/* Theirs to fix: the app is not open. */}
        {status === 'not-running' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <span className="mt-px shrink-0 text-amber-600 dark:text-amber-400" aria-hidden>
              <ShieldOff size={16} />
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-slate-100">E-IMZO dasturi ishga tushmagan</p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Kompyuteringizda E-IMZO ni oching va kalitingiz ulangan bo‘lsin — kalit diskda yoki
                fleshkada bo‘lishi mumkin, E-IMZO uni o‘zi topadi.
              </p>
              <button onClick={() => void probe()} type="button" className="mt-2 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                Qayta tekshirish
              </button>
            </div>
          </div>
        )}

        {/*
          Ours to fix, and the opposite message. E-IMZO is running and refusing this site because
          the domain has no API-KEY from the centre — restarting anything achieves nothing, so do
          not send the director to fix the one part that works. «Qayta tekshirish» is deliberately
          absent for the same reason.
        */}
        {status === 'domain-denied' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
            <span className="mt-px shrink-0 text-rose-600 dark:text-rose-400" aria-hidden>
              <ShieldOff size={16} />
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-slate-100">E-IMZO bu saytga ruxsat bermadi</p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                Dastur ishlayapti — muammo sizda emas. Saytga E-IMZO markazidan domen kaliti
                olinmagan. Buni tizim ma’muri hal qiladi.
              </p>
              {denyReason && <p className="mt-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{denyReason}</p>}
            </div>
          </div>
        )}

        {status === 'ready' && keys.length === 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Kalit topilmadi</p>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              E-IMZO ishlayapti, lekin kalit ko‘rinmadi. Fleshkani ulang yoki kalit{' '}
              <span className="font-mono">DSKEYS</span> papkasida ekanini tekshiring.
            </p>
            <button onClick={() => void probe()} type="button" className="mt-2 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Qayta tekshirish
            </button>
          </div>
        )}

        {/*
          Keys were found, but none of them is the firm's. Named explicitly — "kalit topilmadi"
          would send them to hunt for a flash drive when the key is right there and simply wrong.
        */}
        {status === 'ready' && keys.length > 0 && usableKeys.length === 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Firma kaliti topilmadi</p>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              {keys.length} ta kalit topildi, lekin ularning hech biri{' '}
              <b className="text-slate-700 dark:text-slate-200">{required?.orgName ?? 'tashkilot'}</b> nomiga
              emas{required?.inn ? ` (INN: ${required.inn})` : ''}. Shaxsiy kalit bilan imzolab bo‘lmaydi —
              firma kalitini ulang.
            </p>
            <button onClick={() => void probe()} type="button" className="mt-2 cursor-pointer text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Qayta tekshirish
            </button>
          </div>
        )}

        {status === 'ready' && usableKeys.length > 0 && (
          <Field
            label="Kalit"
            hint="Tanlagach E-IMZO o‘z oynasida parol so‘raydi. Parol bu sahifaga kirmaydi."
          >
            <Select value={alias} onChange={setAlias} options={keyOptions} placeholder="Kalitni tanlang" />
            {/* Say why the list is shorter than what E-IMZO reported, rather than silently hiding keys. */}
            {rejectedCount > 0 && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Yana {rejectedCount} ta kalit topildi, lekin ular tashkilotga tegishli emas — ko‘rsatilmadi.
              </p>
            )}
          </Field>
        )}
      </div>

      {/*
        Said plainly, because the director is putting their name on a legal document and is
        entitled to know what it rests on. The signature below is real — made by their key, on
        their machine — but nobody has checked it: that needs E-IMZO-SERVER and a NIC contract.

        Hidden while signing: they have read it, and the stepper is what matters then.
      */}
      {!busy && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Imzo hujjatlarga biriktiriladi va saqlanadi, lekin hozircha <b>tekshirilmaydi</b> — buning
          uchun davlat E-IMZO serveriga ulanish kerak.
        </p>
      )}
    </Modal>
  );
}
