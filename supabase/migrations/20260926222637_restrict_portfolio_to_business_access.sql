-- Cadastro de empresas segue a mesma fronteira de acesso dos dados operacionais.
drop policy if exists portfolio_authenticated_access on public.portfolio;
create policy portfolio_business_select on public.portfolio
for select to authenticated
using (public.is_founder() or public.user_has_business_access(business_id));
create policy portfolio_founder_all on public.portfolio
for all to authenticated
using (public.is_founder())
with check (public.is_founder());
