import type { ReactNode } from 'react';
import { useAuth } from '@/auth';
import { BusinessProvider } from './BusinessContext';

/** Descarta estado de negócio antes de trocar de conta ou de papel. */
export function SessionBusinessBoundary({ children }: { children: ReactNode }) {
  const { user, role, isFounder, loading } = useAuth();
  const escopo = !loading && user ? `${user.id}:${role ?? 'sem-acesso'}` : 'sem-sessao';
  return <BusinessProvider key={escopo} autorizado={!loading && isFounder}>{children}</BusinessProvider>;
}
