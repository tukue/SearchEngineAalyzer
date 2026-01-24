-- WebAnalyzer Supabase schema + RLS
create extension if not exists "pgcrypto";

create type public.tenant_role as enum ('owner', 'member', 'read_only');
create type public.analysis_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  normalized_url text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, normalized_url),
  unique (id, tenant_id)
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  website_id uuid not null,
  status public.analysis_status not null default 'queued',
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  health_score integer,
  summary jsonb not null default '{}'::jsonb,
  unique (id, tenant_id),
  constraint analyses_website_fk foreign key (website_id, tenant_id)
    references public.websites(id, tenant_id) on delete cascade
);

create table public.analysis_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  analysis_id uuid not null,
  tag_type text not null,
  name text,
  property text,
  content text,
  is_present boolean not null default true,
  constraint analysis_tags_analysis_fk foreign key (analysis_id, tenant_id)
    references public.analyses(id, tenant_id) on delete cascade
);

create table public.analysis_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  analysis_id uuid not null,
  tag_name text not null,
  description text not null,
  example text,
  constraint analysis_recommendations_analysis_fk foreign key (analysis_id, tenant_id)
    references public.analyses(id, tenant_id) on delete cascade
);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  website_id uuid,
  status public.analysis_status not null default 'queued',
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  constraint analysis_jobs_website_fk foreign key (website_id, tenant_id)
    references public.websites(id, tenant_id) on delete set null
);

create index tenant_members_user_idx on public.tenant_members(user_id);
create index websites_tenant_created_idx on public.websites(tenant_id, created_at desc);
create index websites_tenant_normalized_idx on public.websites(tenant_id, normalized_url);
create index analyses_tenant_requested_idx on public.analyses(tenant_id, requested_at desc);
create index analyses_website_requested_idx on public.analyses(website_id, requested_at desc);
create index analyses_tenant_status_idx on public.analyses(tenant_id, status);
create index analysis_tags_analysis_idx on public.analysis_tags(analysis_id);
create index analysis_recommendations_analysis_idx on public.analysis_recommendations(analysis_id);
create index analysis_jobs_status_run_idx on public.analysis_jobs(status, run_at);
create index analysis_jobs_tenant_run_idx on public.analysis_jobs(tenant_id, run_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute procedure public.set_updated_at();

create trigger websites_set_updated_at
before update on public.websites
for each row execute procedure public.set_updated_at();

create or replace function public.is_tenant_member(check_tenant uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = check_tenant
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_owner(check_tenant uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = check_tenant
      and tm.user_id = auth.uid()
      and tm.role = 'owner'
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.websites enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_tags enable row level security;
alter table public.analysis_recommendations enable row level security;
alter table public.analysis_jobs enable row level security;

create policy tenants_select on public.tenants
  for select using (public.is_tenant_member(id));

create policy tenants_insert on public.tenants
  for insert with check (auth.uid() = owner_id);

create policy tenants_update on public.tenants
  for update using (public.is_tenant_owner(id));

create policy tenants_delete on public.tenants
  for delete using (public.is_tenant_owner(id));

create policy tenant_members_select on public.tenant_members
  for select using (public.is_tenant_member(tenant_id));

create policy tenant_members_insert on public.tenant_members
  for insert with check (public.is_tenant_owner(tenant_id));

create policy tenant_members_update on public.tenant_members
  for update using (public.is_tenant_owner(tenant_id));

create policy tenant_members_delete on public.tenant_members
  for delete using (public.is_tenant_owner(tenant_id));

create policy websites_select on public.websites
  for select using (public.is_tenant_member(tenant_id));

create policy websites_insert on public.websites
  for insert with check (public.is_tenant_member(tenant_id));

create policy websites_update on public.websites
  for update using (public.is_tenant_member(tenant_id));

create policy websites_delete on public.websites
  for delete using (public.is_tenant_member(tenant_id));

create policy analyses_select on public.analyses
  for select using (public.is_tenant_member(tenant_id));

create policy analyses_insert on public.analyses
  for insert with check (public.is_tenant_member(tenant_id));

create policy analyses_update on public.analyses
  for update using (public.is_tenant_member(tenant_id));

create policy analyses_delete on public.analyses
  for delete using (public.is_tenant_member(tenant_id));

create policy analysis_tags_select on public.analysis_tags
  for select using (public.is_tenant_member(tenant_id));

create policy analysis_tags_insert on public.analysis_tags
  for insert with check (public.is_tenant_member(tenant_id));

create policy analysis_tags_update on public.analysis_tags
  for update using (public.is_tenant_member(tenant_id));

create policy analysis_tags_delete on public.analysis_tags
  for delete using (public.is_tenant_member(tenant_id));

create policy analysis_recommendations_select on public.analysis_recommendations
  for select using (public.is_tenant_member(tenant_id));

create policy analysis_recommendations_insert on public.analysis_recommendations
  for insert with check (public.is_tenant_member(tenant_id));

create policy analysis_recommendations_update on public.analysis_recommendations
  for update using (public.is_tenant_member(tenant_id));

create policy analysis_recommendations_delete on public.analysis_recommendations
  for delete using (public.is_tenant_member(tenant_id));

create policy analysis_jobs_select on public.analysis_jobs
  for select using (public.is_tenant_member(tenant_id));

create policy analysis_jobs_insert on public.analysis_jobs
  for insert with check (public.is_tenant_member(tenant_id));

create policy analysis_jobs_update on public.analysis_jobs
  for update using (public.is_tenant_member(tenant_id));

create policy analysis_jobs_delete on public.analysis_jobs
  for delete using (public.is_tenant_member(tenant_id));
