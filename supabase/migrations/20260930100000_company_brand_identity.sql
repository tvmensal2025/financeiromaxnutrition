-- One canonical identity per company, under existing portfolio RLS and CAS.
alter table public.portfolio add column if not exists brand_identity jsonb;
comment on column public.portfolio.brand_identity is 'Company identity v1. Founder-approved logo, palette, audience, positioning and creative guidance. Edit with helena_write_record and the row_version read by the user.';

create or replace function public.helena_validate_brand_identity()
returns trigger language plpgsql set search_path = '' as $function$
declare v jsonb := new.brand_identity; field text;
begin
  if v is null then return new; end if;
  if jsonb_typeof(v) is distinct from 'object' or v->>'business_id' is distinct from new.business_id
    or v->>'schema_version' is distinct from '1' or coalesce(v->>'status','') not in ('DRAFT','APPROVED') then
    raise exception 'Identidade invalida ou de outra empresa';
  end if;
  if v->>'status'='APPROVED' then
    foreach field in array array['name','logo_url','description','audience','offer','positioning','voice','imagery','logo_rules','layout_rules','cta','channels','restrictions','sources','review','heading_font','body_font'] loop
      if jsonb_typeof(v->field) is distinct from 'string' or length(btrim(v->>field))=0 then raise exception 'Identidade incompleta: %',field; end if;
    end loop;
    if v->'logo_approved' is distinct from 'true'::jsonb or jsonb_typeof(v->'colors') is distinct from 'array' then
      raise exception 'Logo e cores precisam de aprovacao';
    end if;
    if jsonb_array_length(v->'colors') < 1 or jsonb_array_length(v->'colors') > 8
      or exists(select 1 from jsonb_array_elements(v->'colors') c where coalesce(c->>'hex','') !~ '^#[a-fA-F0-9]{6}$') then
      raise exception 'Paleta de cores invalida';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists validate_brand_identity on public.portfolio;
create trigger validate_brand_identity before insert or update of brand_identity on public.portfolio
for each row execute function public.helena_validate_brand_identity();

create table if not exists public.company_brand_history (
  id bigint generated always as identity primary key,
  business_id text not null references public.portfolio(business_id),
  row_version bigint not null,
  brand_identity jsonb,
  changed_by uuid,
  created_at timestamptz not null default now()
);
alter table public.company_brand_history enable row level security;
create index if not exists company_brand_history_business_time on public.company_brand_history(business_id,created_at desc);
revoke all on public.company_brand_history from anon, authenticated;
grant select on public.company_brand_history to authenticated;
drop policy if exists company_brand_history_read on public.company_brand_history;
create policy company_brand_history_read on public.company_brand_history for select to authenticated
using (public.is_founder() or public.user_has_business_access(business_id));
insert into public.company_brand_history(business_id,row_version,brand_identity)
select business_id,row_version,brand_identity from public.portfolio p where brand_identity is not null
and not exists(select 1 from public.company_brand_history h where h.business_id=p.business_id and h.row_version=p.row_version);
create or replace function public.helena_record_brand_history()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if old.brand_identity is distinct from new.brand_identity then
    insert into public.company_brand_history(business_id,row_version,brand_identity,changed_by)
    values(new.business_id,new.row_version,new.brand_identity,auth.uid());
  end if;
  return new;
end;
$function$;
revoke all on function public.helena_record_brand_history() from public, anon, authenticated;
drop trigger if exists record_brand_history on public.portfolio;
create trigger record_brand_history after update of brand_identity on public.portfolio
for each row execute function public.helena_record_brand_history();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('helena-brand-assets','helena-brand-assets',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
drop policy if exists brand_assets_read on storage.objects;
create policy brand_assets_read on storage.objects for select to authenticated
using(bucket_id='helena-brand-assets' and (public.is_founder() or public.user_has_business_access((storage.foldername(name))[1])));
drop policy if exists brand_assets_create on storage.objects;
create policy brand_assets_create on storage.objects for insert to authenticated
with check(bucket_id='helena-brand-assets' and public.is_founder() and exists(select 1 from public.portfolio p where p.business_id=(storage.foldername(name))[1]));
-- Append-only objects. Versions remain available to historical briefs.

-- Initial direction requested by the founder. Palette accepted; logo remains draft.
-- Never overwrite an existing identity on reapplication.
do $seed$
declare company public.portfolio;
begin
  select * into company from public.portfolio where business_id='BIZ-003' for update;
  if found and company.brand_identity is null then
    perform public.helena_write_record('portfolio',company.business_id,company.row_version,
      jsonb_build_object('brand_identity',$brand${
  "schema_version": 1,
  "business_id": "BIZ-003",
  "name": "Humano Digital",
  "status": "DRAFT",
  "logo_url": "/brand/humano-digital/logo.svg",
  "logo_approved": false,
  "reference_image": "/brand/humano-digital/referencia-verde.png",
  "colors": [
    {"name":"Verde principal","hex":"#075E47","use":"Marca, títulos e chamadas para ação"},
    {"name":"Verde profundo","hex":"#163D32","use":"Texto e fundos de destaque"},
    {"name":"Marfim","hex":"#F4F5EB","use":"Fundo e áreas de respiro"},
    {"name":"Sálvia","hex":"#BCD2B5","use":"Apoio e detalhes; evitar texto pequeno sobre branco"}
  ],
  "heading_font":"Manrope — títulos com peso 700 ou 800",
  "body_font":"Manrope — textos com peso 400 ou 500",
  "description":"Projeto que conecta pessoas ao trabalho com inteligência artificial. O fundador descreve a proposta como uma agência de emprego de IA. A atuação deve ser explicada de forma humana, clara e responsável.",
  "audience":"Pessoas interessadas em conhecer possibilidades de trabalhar com tecnologia e inteligência artificial. Não pressupor experiência, contratação ou remuneração confirmadas.",
  "offer":"Apresentação do projeto e captação de interessados. Vagas, serviços, critérios de participação, condições comerciais e remuneração precisam de confirmação antes de divulgação.",
  "positioning":"Pessoas no centro, com a inteligência artificial como apoio. Comunicação acolhedora, profissional e acessível, sem aparência de promessa de dinheiro fácil.",
  "voice":"Português brasileiro, direto, acolhedor e confiante. Explicar termos de IA em linguagem simples. Evitar jargões técnicos, urgência artificial, exageros e garantias de resultado.",
  "imagery":"Pessoas adultas em situações reais de trabalho, luz natural, ambientes organizados e expressão espontânea. Um robô amigável pode representar a IA como apoio, sem parecer um produto real oferecido. Preferir fotografia editorial ou imagem gerada de alta qualidade; conferir mãos, rostos e telas. Nunca entregar apenas molduras vazias.",
  "logo_rules":"Usar o logo aprovado sem redesenhar, distorcer ou recolorir. Preservar respiro equivalente à altura do símbolo; posicionar sobre área limpa e de bom contraste. Esta assinatura tipográfica é uma proposta inicial e precisa de aprovação antes de uso em campanha.",
  "layout_rules":"Post vertical 1080×1350 e story 1080×1920 quando solicitados. Uma ideia principal por peça, imagem protagonista, título curto e CTA legível. Manter textos longe das bordas e dos controles do aplicativo. Conferir a peça final no tamanho de um celular. Não copiar logos ou textos de referências de terceiros.",
  "cta":"Convite sugerido: Envie QUERO no direct. Usar somente após confirmar o perfil oficial e quem responderá. Não inventar link, número de WhatsApp ou endereço de inscrição.",
  "channels":"Nome citado pelo fundador: Humano Digital.pro. Domínio, perfil oficial do Instagram e número de WhatsApp ainda precisam ser confirmados; não assumir que estão ativos.",
  "restrictions":"Não prometer vaga, contratação, salário, renda, comissão ou resultado garantido. Não inventar depoimentos, parceiros, certificações ou condições. Separar fatos confirmados de propostas. Nenhuma publicação ou contato externo sem autorização.",
  "sources":"Decisão do fundador nesta conversa: adotar o verde da arte de referência. Descrição do negócio dada pelo fundador: agência de emprego de IA. A imagem de referência foi gerada no Codex; não é evidência de execução da equipe Hermes. Outras referências precisam ter origem e direito de uso registrados.",
  "review":"O revisor designado no fluxo vigente deve abrir cada arquivo final, conferir a copy, logo, cores, imagem, contraste e empresa correta. Helena supervisiona; o fundador recebe as artes e a legenda limpas. Dimensões ou presença de arquivo não bastam para aprovar. Bloquear entrega se faltar ferramenta ou informação essencial."
}
$brand$::jsonb),false);
  end if;
end;
$seed$;
