-- Private, size-limited assets for reviewed Helena job deliveries.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('helena-deliveries', 'helena-deliveries', false, 5242880, array['image/png'])
on conflict (id) do nothing;

-- A signed link may be issued only to a user who can read the corresponding
-- business job. Uploads are issued by the Gateway for the job's Hermes owner.
create policy helena_deliveries_business_read
on storage.objects for select to authenticated
using (
  bucket_id = 'helena-deliveries'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) <> ''
  and exists (
    select 1 from public.agent_jobs j
    where j.business_id = split_part(name, '/', 1)
      and j.job_id = split_part(name, '/', 2)
      and public.user_has_business_access(j.business_id)
  )
);
