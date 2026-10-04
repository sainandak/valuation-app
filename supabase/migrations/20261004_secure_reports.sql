-- Idempotent, robust migration for reports and audit logging

-- 1. Ensure table exists
create table if not exists public.reports (
  id text primary key,
  date date not null default current_date,
  owner text not null default '',
  cert text not null default '',
  total numeric not null default 0 check(total >= 0),
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Add columns if table already existed without them
alter table public.reports add column if not exists user_id uuid references auth.users(id);
alter table public.reports add column if not exists version integer not null default 1;
alter table public.reports add column if not exists created_at timestamptz not null default now();
alter table public.reports add column if not exists updated_at timestamptz not null default now();
alter table public.reports add column if not exists deleted_at timestamptz;

-- 3. Audit events table
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  report_id text references public.reports(id),
  action text not null,
  report_version integer not null,
  occurred_at timestamptz not null default now(),
  previous_hash text,
  event_hash text not null,
  metadata jsonb not null default '{}'::jsonb
);

-- 4. Enable Row Level Security
alter table public.reports enable row level security;
alter table public.audit_events enable row level security;

-- 5. Drop existing policy if present and recreate
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports for select to authenticated using(user_id = auth.uid());

-- 6. Permissions
revoke all on public.reports, public.audit_events from anon, authenticated;
grant select on public.reports to authenticated;

-- 7. Secure RPC: save_report
create or replace function public.save_report(p_report jsonb, p_expected_version integer default 0)
returns public.reports language plpgsql security definer set search_path=public as $$
declare
  current public.reports;
  saved public.reports;
  prior text;
  event_data text;
  audit_action text;
  v_expected integer := coalesce(p_expected_version, 0);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_report->>'id','')='' or coalesce(p_report->>'owner','')='' or coalesce(p_report->>'cert','')='' or coalesce(p_report->>'valuer','')='' then
    raise exception 'Incomplete report';
  end if;

  select * into current from public.reports where id=p_report->>'id' for update;

  if found then
    if current.user_id is not null and current.user_id <> auth.uid() then
      raise exception 'Not permitted';
    end if;

    if v_expected > 0 and current.version <> v_expected then
      raise exception 'Report changed on another device' using errcode='40001';
    end if;

    update public.reports
    set user_id = auth.uid(),
        date = (p_report->>'date')::date,
        owner = p_report->>'owner',
        cert = p_report->>'cert',
        total = coalesce((p_report->>'total')::numeric, 0),
        data = p_report,
        version = coalesce(current.version, 0) + 1,
        updated_at = now(),
        deleted_at = null
    where id = current.id
    returning * into saved;

    audit_action := 'updated';
  else
    insert into public.reports(id, user_id, date, owner, cert, total, data, version)
    values(
      p_report->>'id',
      auth.uid(),
      (p_report->>'date')::date,
      p_report->>'owner',
      p_report->>'cert',
      coalesce((p_report->>'total')::numeric, 0),
      p_report,
      1
    )
    returning * into saved;

    audit_action := 'created';
  end if;

  select event_hash into prior from public.audit_events order by id desc limit 1;
  event_data := coalesce(prior,'') || '|' || auth.uid() || '|' || saved.id || '|' || saved.version || '|' || now()::text;

  insert into public.audit_events(actor_id, report_id, action, report_version, previous_hash, event_hash, metadata)
  values(auth.uid(), saved.id, audit_action, saved.version, prior, encode(sha256(convert_to(event_data, 'utf8')), 'hex'), jsonb_build_object('cert', saved.cert));

  return saved;
end $$;

-- 8. Secure RPC: delete_report
create or replace function public.delete_report(p_id text, p_expected_version integer default 0)
returns void language plpgsql security definer set search_path=public as $$
declare
  current public.reports;
  prior text;
  event_data text;
  v_expected integer := coalesce(p_expected_version, 0);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into current from public.reports where id=p_id for update;

  if not found or (current.user_id is not null and current.user_id <> auth.uid()) then
    raise exception 'Not permitted';
  end if;

  if v_expected > 0 and current.version <> v_expected then
    raise exception 'Report changed on another device' using errcode='40001';
  end if;

  update public.reports
  set deleted_at = now(),
      version = coalesce(version, 0) + 1,
      updated_at = now()
  where id = p_id
  returning * into current;

  select event_hash into prior from public.audit_events order by id desc limit 1;
  event_data := coalesce(prior,'') || '|' || auth.uid() || '|' || current.id || '|deleted|' || current.version || '|' || now()::text;

  insert into public.audit_events(actor_id, report_id, action, report_version, previous_hash, event_hash)
  values(auth.uid(), current.id, 'deleted', current.version, prior, encode(sha256(convert_to(event_data, 'utf8')), 'hex'));
end $$;

-- 9. Function execution grants
revoke all on function public.save_report(jsonb,integer) from public;
revoke all on function public.delete_report(text,integer) from public;
grant execute on function public.save_report(jsonb,integer) to authenticated;
grant execute on function public.delete_report(text,integer) to authenticated;
