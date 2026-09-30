import { describe, it, expect } from 'vitest';
import { brandSchema, brandMissing, emptyBrand, safeBrandAsset } from './brand-identity';
import humano from '@/data/humano-digital-brand.json';
describe('identidade por empresa', () => {
  it('preserva proposta sem aprovar logo automaticamente', () => {
    const brand = brandSchema.parse(humano);
    expect(brand.status).toBe('DRAFT');
    expect(brandMissing(brand)).toEqual(['Logo aprovado']);
    expect(brandMissing({...brand,logo_approved:true})).toEqual([]);
  });
  it('outra empresa começa vazia, sem herdar cores, logo ou oferta', () => {
    const health = brandSchema.parse(emptyBrand('BIZ-002', 'Saúde360'));
    expect(health.logo_url).toBe(''); expect(health.colors).toEqual([]); expect(health.description).toBe('');
    expect(brandMissing(health)).toContain('Logo aprovado');
  });
  it('recusa links executáveis e travessia de caminhos', () => {
    for(const value of ['javascript:alert(1)','data:text/html,x','/brand/../secret','https://user:pass@example.com']) expect(safeBrandAsset(value)).toBe(false);
    expect(safeBrandAsset('storage://helena-brand-assets/BIZ-003/logo.png')).toBe(true);
  });
});
