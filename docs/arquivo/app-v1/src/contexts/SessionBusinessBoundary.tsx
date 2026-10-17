import type { ReactNode } from 'react';
import { useAuth } from '@/auth';
import { BusinessProvider } from './BusinessContext';

/** Descarta estado de negócio antes de trocar de conta ou de papel. */
export function SessionBusinessBoundary({ children }: { children: ReactNode }) {
  const { user, role, isMember, loading } = useAuth();
  const escopo = !loading && isMember && user
    ? `${user.id}:${role}` : 'sem-acesso';
  return <BusinessProvider key={escopo} autorizado={escopo !== 'sem-acesso'}>{children}</BusinessProvider>;
}
