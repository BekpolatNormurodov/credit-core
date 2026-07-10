import { useNavigate, useParams } from 'react-router-dom';
import type { CaseSectionKey } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { Check } from '../../lib/icons';
import { cn } from '../../lib/cn';
import { useOriginationForm } from './useOriginationForm';
import { Step1, Step2, Step3, StepSugurta, StepGarov, Step4, Step5 } from './steps';
import { Summary } from './Summary';

const STEPS: { title: string; section: CaseSectionKey; Comp: (p: { f: ReturnType<typeof useOriginationForm> }) => JSX.Element }[] = [
  { title: 'Qarz oluvchi', section: 'borrower', Comp: Step1 },
  { title: 'Ish & daromad', section: 'employment', Comp: Step2 },
  { title: 'Liniya', section: 'creditLine', Comp: Step3 },
  { title: 'Sug‘urta', section: 'creditLine', Comp: StepSugurta },
  { title: 'Garov', section: 'creditLine', Comp: StepGarov },
  { title: 'Transh', section: 'creditLine', Comp: Step4 },
  { title: 'KATM', section: 'creditHistory', Comp: Step5 },
];

export function OriginationWizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const f = useOriginationForm(id);
  const { Comp } = STEPS[f.step];

  const next = async () => {
    if (f.stepHasErrors(f.step)) { f.setAttempted(true); toast.error('Tekshiring', 'Majburiy maydonlarni to‘ldiring'); return; }
    try {
      await f.saveSection(STEPS[f.step].section);
      if (f.step < STEPS.length - 1) f.setStep(f.step + 1);
    } catch {
      toast.error('Saqlanmadi', 'Qayta urinib ko‘ring');
    }
  };
  // Jumping between steps autosaves the current one (best-effort) so progress persists per step —
  // only once the case exists, to avoid creating empty drafts from stray clicks.
  const goTo = async (i: number) => {
    if (i === f.step) return;
    if (f.caseId) { try { await f.saveSection(STEPS[f.step].section); } catch { /* keep draft in memory */ } }
    f.setStep(i);
  };
  const finish = async () => {
    const s = await f.save();
    if (!s) { toast.error('Tekshiring', 'Majburiy maydonlar to‘ldirilmagan'); return; }
    toast.success('Saqlandi', s.number);
    nav(`/cases/${s.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{id ? 'Arizani to‘ldirish' : 'Yangi ariza'}</h1>
          <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-400">Bosqich {f.step + 1}/{STEPS.length}</span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Har bosqich alohida saqlanadi — istalgan vaqtda qaytib tuzatishingiz mumkin</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${((f.step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => {
              const current = i === f.step; // selected
              const complete = f.stepComplete(i); // has required fields AND all filled correctly
              const invalid = f.attempted && f.stepHasErrors(i); // touched, still missing a required field
              return (
                <li key={i}>
                  <button
                    onClick={() => goTo(i)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                      current && 'ring-2 ring-brand-500/40', // selected — always visibly distinct
                      complete
                        ? 'border-success-300 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400'
                        : invalid
                          ? 'border-error-300 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400'
                          : current
                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5',
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                      complete ? 'bg-success-600 text-white' : invalid ? 'bg-error-600 text-white' : current ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    )}>
                      {complete ? <Check className="h-3 w-3" /> : invalid ? '!' : i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <Comp f={f} />
          <div className="flex items-center justify-between">
            <Button variant="secondary" disabled={f.step === 0} onClick={() => f.setStep(f.step - 1)}>Orqaga</Button>
            {f.step < STEPS.length - 1
              ? <Button onClick={next} loading={f.saving}>Saqlash va davom</Button>
              : <Button onClick={finish} loading={f.saving}>Yakunlash</Button>}
          </div>
        </div>
        <aside><Summary form={f.form} /></aside>
      </div>
    </div>
  );
}
