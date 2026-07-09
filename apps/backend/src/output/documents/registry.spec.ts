import { DOC_REGISTRY } from './registry';

describe('DOC_REGISTRY', () => {
  it('exposes the first-slice documents with metadata', () => {
    expect(Object.keys(DOC_REGISTRY).sort()).toEqual(['contract', 'creditApplication', 'petition', 'prikaz']);
    for (const key of Object.keys(DOC_REGISTRY)) {
      const d = DOC_REGISTRY[key];
      expect(typeof d.title).toBe('string');
      expect(['uz', 'ru']).toContain(d.lang);
      expect(typeof d.build).toBe('function');
    }
  });
});
