import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { DeliveryGallery } from './DeliveryGallery';
const media = vi.hoisted(() => vi.fn());
vi.mock('@/lib/media-client', () => ({ signedMedia: media }));
const job = 'JOB-HR-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const reference = `storage://helena-deliveries/BIZ-003/${job}/post-v1.png`;
const props = { businessId: 'BIZ-003', jobId: job, references: [reference], title: 'Campanha' };
beforeEach(() => media.mockReset());
afterEach(cleanup);

describe('recipient artwork gallery', () => {
  it('does not request or display another company artwork', () => {
    render(<DeliveryGallery {...props} businessId="BIZ-002" />);
    expect(media).not.toHaveBeenCalled();
    expect(screen.queryByText('As artes, em detalhe.')).not.toBeInTheDocument();
  });
  it('recovers from a failed signed link without retry loops', async () => {
    media.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ reference, url: 'https://example.test/post.png' }]);
    render(<DeliveryGallery {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar abrir novamente' }));
    expect(await screen.findByRole('img', { name: 'Post: Campanha' })).toBeInTheDocument();
    expect(media).toHaveBeenCalledTimes(2);
    fireEvent.error(screen.getByRole('img', { name: 'Post: Campanha' }));
    expect(screen.getByText('Não foi possível abrir esta imagem.')).toBeInTheDocument();
    expect(media).toHaveBeenCalledTimes(2);
  });
  it('discards an old response when switching jobs', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    media.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    const nextJob = 'JOB-HR-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const nextRef = `storage://helena-deliveries/BIZ-003/${nextJob}/post-v1.png`;
    media.mockResolvedValueOnce([{ reference: nextRef, url: 'https://example.test/new.png' }]);
    const view = render(<DeliveryGallery {...props} />);
    view.rerender(<DeliveryGallery {...props} jobId={nextJob} references={[nextRef]} title="Nova campanha" />);
    await screen.findByRole('img', { name: 'Post: Nova campanha' });
    resolveOld([{ reference, url: 'https://example.test/old.png' }]);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.test/new.png'));
  });
  it('opens the original composition in an accessible lightbox', async () => {
    media.mockResolvedValue([{ reference, url: 'https://example.test/post.png' }]);
    render(<DeliveryGallery {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ampliar Post, versão 1' }));
    expect(screen.getByRole('dialog', { name: 'Arte ampliada: Campanha' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar ampliação' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
