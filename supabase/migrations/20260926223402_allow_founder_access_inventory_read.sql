-- O fundador precisa auditar o inventário de acesso. Membros continuam lendo somente a própria linha.
-- is_founder usa auth.uid() e consulta app_access como SECURITY DEFINER, evitando recursão da policy.
create policy app_access_founder_read on public.app_access
for select to authenticated
using (public.is_founder());
