import { describe, it, expect } from 'vitest';
import { trustedMediaUrl } from './media-client';
describe('private media URLs', () => {
  const ref = 'storage://helena-brand-assets/BIZ-003/logo.png';
  const base = 'https://ae2b5f97708d13fa7e187cb470aafc40.r2.cloudflarestorage.com/helena-media/helena-brand-assets/BIZ-003/logo.png';
  const url = `${base}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=test&X-Amz-Expires=300`;
  it('allows only the configured R2 account, private bucket, exact path and short-lived signature', () => {
    expect(trustedMediaUrl(url,ref)).toBe(true);
    for (const invalid of [url.replace('BIZ-003','BIZ-002'),url.replace('helena-media/','ids-media/'),url.replace('300','7200'),url.replace('.r2.cloudflarestorage.com','.evil.test'),base,`https://secret@${url.slice(8)}`]) expect(trustedMediaUrl(invalid,ref)).toBe(false);
  });
});
