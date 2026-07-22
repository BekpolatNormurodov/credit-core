import { DOC_REGISTRY } from './registry';

const NOTARY_KEYS = ['actNotary', 'prikazNotary', 'rklGenNotary'];
const ACCOUNTANT_KEYS = ['accountantSplit', 'disbursement'];
// Only the notary copies wait for the signature. The monitoring acts are blank inspection forms
// whose visit dates come from the application date, so the office can prepare them beforehand.
const APPROVED_STAGE_KEYS = [...NOTARY_KEYS];

const expectedCategory = (key: string): 'main' | 'notary' | 'accountant' =>
  NOTARY_KEYS.includes(key) ? 'notary' : ACCOUNTANT_KEYS.includes(key) ? 'accountant' : 'main';

describe('DOC_REGISTRY', () => {
  it('exposes the first-slice documents with metadata', () => {
    expect(Object.keys(DOC_REGISTRY).sort()).toEqual([
      'accountantSplit',
      'act',
      'actNotary',
      'cheklist',
      'contract',
      'creditApplication',
      'disbursement',
      'grafik',
      'monitoring1',
      'monitoring2',
      'monitoring3',
      'obloshka',
      'petition',
      'prikaz',
      'prikazNotary',
      'protokol',
      'rklGen',
      'rklGenNotary',
      'scoreReport',
    ]);
    for (const key of Object.keys(DOC_REGISTRY)) {
      const d = DOC_REGISTRY[key];
      expect(typeof d.title).toBe('string');
      expect(['uz', 'ru']).toContain(d.lang);
      expect(typeof d.build).toBe('function');
      expect(['main', 'notary', 'accountant']).toContain(d.category);
      expect(d.category).toBe(expectedCategory(key));
      expect(['review', 'approved']).toContain(d.stage);
      expect(d.stage).toBe(APPROVED_STAGE_KEYS.includes(key) ? 'approved' : 'review');
    }
  });

  it('categorizes exactly the 3 notary copies separately from the main set', () => {
    const notaryKeys = Object.keys(DOC_REGISTRY).filter((k) => DOC_REGISTRY[k].category === 'notary').sort();
    expect(notaryKeys).toEqual([...NOTARY_KEYS].sort());
  });

  it('categorizes the accountant (buxgalteriya) money documents into their own section', () => {
    const accountantKeys = Object.keys(DOC_REGISTRY).filter((k) => DOC_REGISTRY[k].category === 'accountant').sort();
    expect(accountantKeys).toEqual([...ACCOUNTANT_KEYS].sort());
  });

  it('gates only the notary copies to the approved stage; everything else is available at review', () => {
    const approvedKeys = Object.keys(DOC_REGISTRY).filter((k) => DOC_REGISTRY[k].stage === 'approved').sort();
    expect(approvedKeys).toEqual([...APPROVED_STAGE_KEYS].sort());
  });
});
