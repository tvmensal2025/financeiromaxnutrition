-- Reject shallow Hermes briefs even when a coordinator uses the database RPC
-- directly instead of the Gateway release endpoint. No existing job is changed.
create or replace function public.helena_validate_professional_brief(p_instruction text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  titles text[] := array[
    'Contexto e fontes', 'Objetivo e impacto', 'Escopo e limites',
    'Plano de trabalho', 'Entregáveis', 'Critérios de pronto',
    'Evidências e registro', 'Revisão e encaminhamento'
  ];
  positions integer[] := '{}'::integer[];
  heading text;
  pos integer;
  body_start integer;
  body_end integer;
  i integer;
begin
  if p_instruction is null or pg_catalog.char_length(p_instruction) not between 700 and 8000 then
    raise exception 'Briefing profissional exige 700 a 8000 caracteres' using errcode='22023';
  end if;
  for i in 1..pg_catalog.array_length(titles, 1) loop
    heading := '## ' || titles[i];
    pos := pg_catalog.strpos(p_instruction, heading);
    if pos = 0 or (pos > 1 and pg_catalog.substr(p_instruction, pos - 1, 1) <> E'\n')
       or pg_catalog.substr(p_instruction, pos + pg_catalog.char_length(heading), 1) not in (E'\n', E'\r')
       or (i > 1 and pos <= positions[i-1]) then
      raise exception 'Briefing profissional sem secao ordenada: %', titles[i] using errcode='22023';
    end if;
    positions := pg_catalog.array_append(positions, pos);
  end loop;
  for i in 1..pg_catalog.array_length(titles, 1) loop
    body_start := positions[i] + pg_catalog.char_length('## ' || titles[i]);
    body_end := case when i < pg_catalog.array_length(titles, 1)
                     then positions[i+1] else pg_catalog.char_length(p_instruction) + 1 end;
    if pg_catalog.char_length(pg_catalog.btrim(
         pg_catalog.substr(p_instruction, body_start, body_end-body_start), E' \n\r\t')) < 40 then
      raise exception 'Briefing profissional raso na secao: %', titles[i] using errcode='22023';
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.helena_validate_professional_brief(text) from public, anon, authenticated;
grant execute on function public.helena_validate_professional_brief(text) to service_role;

create or replace function public.helena_guard_ready_brief()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'READY' and new.job_id like 'JOB-HR-%' then
    perform public.helena_validate_professional_brief(new.instruction);
  end if;
  return new;
end;
$$;

drop trigger if exists agent_jobs_professional_brief_guard on public.agent_jobs;
create trigger agent_jobs_professional_brief_guard
before insert or update of status, instruction on public.agent_jobs
for each row when (new.status = 'READY')
execute function public.helena_guard_ready_brief();
