import { DOC_REGISTRY } from './registry';

describe('DOC_REGISTRY', () => {
  it('exposes the first-slice documents with metadata', () => {
    expect(Object.keys(DOC_REGISTRY).sort()).toEqual([
      'accountantSplit',
      'act',
      'actNotary',
      'cheklist',
      'contract',
      'creditApplication',
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
    }
  });
});
