import { watermarkForStatus } from './doc-layout';

describe('watermarkForStatus', () => {
  it('is grey TASDIQLANMAGAN while under review', () => {
    expect(watermarkForStatus('MODERATION')).toEqual({ text: 'TASDIQLANMAGAN', color: '#9ca3af' });
    expect(watermarkForStatus('DIRECTOR_REVIEW')).toEqual({ text: 'TASDIQLANMAGAN', color: '#9ca3af' });
  });
  it('turns green TASDIQLANGAN once the director signs (ADMIN_FINALIZE) and after finalize', () => {
    expect(watermarkForStatus('ADMIN_FINALIZE')).toEqual({ text: 'TASDIQLANGAN', color: '#16a34a' });
    expect(watermarkForStatus('FINALIZED')).toEqual({ text: 'TASDIQLANGAN', color: '#16a34a' });
  });
  it('is red for rejected / cancelled', () => {
    expect(watermarkForStatus('REJECTED')).toEqual({ text: 'RAD ETILGAN', color: '#dc2626' });
    expect(watermarkForStatus('CANCELLED')).toEqual({ text: 'BEKOR QILINGAN', color: '#dc2626' });
  });
  it('has no watermark for a draft', () => {
    expect(watermarkForStatus('DRAFT')).toBeNull();
  });
});
