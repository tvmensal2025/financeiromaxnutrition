import { beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ from: vi.fn(), signed: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: mock.from } } }));
import { brandPreview, uploadBrand } from './media-client';

beforeEach(() => {
  vi.clearAllMocks();
  mock.from.mockReturnValue({ createSignedUrl: mock.signed, upload: mock.upload });
});

it('assina somente referências do bucket privado e da pasta de empresa', async () => {
  mock.signed.mockResolvedValue({ data: { signedUrl: 'https://signed.example/logo' }, error: null });
  await expect(brandPreview('storage://helena-brand-assets/BIZ-004/logo.png')).resolves.toBe('https://signed.example/logo');
  expect(mock.from).toHaveBeenCalledWith('helena-brand-assets');
  expect(mock.signed).toHaveBeenCalledWith('BIZ-004/logo.png', 300);
  await expect(brandPreview('storage://helena-brand-assets/BIZ-004/../other.png')).rejects.toThrow('inválida');
  expect(mock.signed).toHaveBeenCalledTimes(1);
});

it('recusa enviar logo sem empresa válida antes de acessar Storage', async () => {
  const file = new File(['logo'], 'logo.png', { type: 'image/png' });
  await expect(uploadBrand('GRUPO', file)).rejects.toThrow('empresa válida');
  expect(mock.from).not.toHaveBeenCalled();
});
