import { useNavigate, useParams } from 'react-router-dom';
import type { CaseSectionKey } from '@credit-core/shared';
import { Button } from '../../components/primitives';
import { useToast } from '../../components/Toast';
import { useOriginationForm } from './useOriginationForm';
import { Step1, Step2, Step3, Step4, Step5 } from './steps';
import { Summary } from './Summary';

const STEPS: { title: string; section: CaseSectionKey; Comp: (p: { f: ReturnType<typeof useOriginationForm> }) => JSX.Element }[] = [
  { title: 'Qarz oluvchi', section: 'borrower', Comp: Step1 },
  { title: 'Ish & daromad', section: 'employment', Comp: Step2 },
  { title: 'Liniya & garov', section: 'creditLine', Comp: Step3 },
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
    try {
      await f.saveSection(STEPS[f.step].section);
      if (f.step < STEPS.length - 1) f.setStep(f.step + 1);
    } catch {
      toast.error('Saqlanmadi', 'Majburiy maydonlarni tekshiring');
    }
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{id ? 'Arizani to‘ldirish' : 'Yangi ariza'}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">5 bosqich — har biri alohida saqlanadi</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => f.setStep(i)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${i === f.step ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5'}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${i === f.step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{i + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
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
