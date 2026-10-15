-- Docket: tables, row-level security, storage and functions.
create extension if not exists pgcrypto;

-- Workspaces: one private sandbox per visitor -------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ashgrove Bakery',
  story_date date not null,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner',
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Catalog -------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  key text not null,
  name text not null,
  short text not null,
  aliases text[] not null default '{}',
  delivery_days int[] not null
);
create index customers_ws_idx on public.customers (workspace_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  sku text not null,
  name text not null,
  unit text not null default 'each',
  pack int not null default 1,
  dough text not null,
  dough_g int not null default 0,
  active boolean not null default true
);
create index products_ws_idx on public.products (workspace_id);

create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  alias text not null,
  customer_id uuid references public.customers on delete cascade,
  source text not null check (source in ('seed', 'learned')),
  created_at timestamptz not null default now()
);
create index product_aliases_ws_idx on public.product_aliases (workspace_id);

-- Documents and what was read from them -------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  sample_key text,
  source text not null check (source in ('pdf', 'photo', 'email', 'csv')),
  title text not null,
  sender text,
  file_path text,
  mime text,
  text_layer jsonb not null default '{"kind":"none"}',
  body_text text,
  status text not null default 'reading'
    check (status in ('reading', 'ready', 'needs_check', 'approved', 'rejected', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index documents_ws_idx on public.documents (workspace_id, received_at desc);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  document_id uuid not null references public.documents on delete cascade,
  mode text not null,
  kind text not null,
  model text not null,
  captured text not null,
  raw jsonb not null,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index readings_doc_idx on public.readings (document_id);

-- Orders ----------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  document_id uuid unique references public.documents on delete cascade,
  customer_id uuid references public.customers on delete set null,
  customer_raw text,
  customer_ref jsonb not null default '{"kind":"none"}',
  delivery_date date,
  delivery_reason text,
  delivery_ref jsonb not null default '{"kind":"none"}',
  po_number text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  duplicate_of uuid,
  is_history boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_ws_date_idx on public.orders (workspace_id, delivery_date);
create index orders_ws_status_idx on public.orders (workspace_id, status);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  line_no int not null,
  raw_text text not null default '',
  product_text text not null default '',
  product_id uuid references public.products on delete set null,
  qty numeric,
  unit_raw text not null default '',
  qty_each int,
  match_method text not null default 'none',
  match_score numeric,
  source_ref jsonb not null default '{"kind":"none"}',
  removed boolean not null default false,
  unique (order_id, line_no)
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  line_no int,
  code text not null,
  severity text not null check (severity in ('blocker', 'check', 'info')),
  message text not null,
  data jsonb not null default '{}',
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now()
);
create index flags_order_idx on public.flags (order_id);

create table public.field_edits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  order_id uuid not null references public.orders on delete cascade,
  line_no int,
  field text not null,
  ai_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  type text not null,
  summary text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_ws_idx on public.events (workspace_id, created_at desc);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  order_id uuid,
  event text not null,
  payload jsonb not null,
  signature text not null,
  status int not null,
  verified boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

-- Only reachable through consume_reading_quota and reading_quota_left.
create table public.reading_quota (
  day date not null,
  scope text not null,
  count int not null default 0,
  primary key (day, scope)
);

-- Row-level security ------------------------------------------------------------
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;
revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.documents enable row level security;
alter table public.readings enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.flags enable row level security;
alter table public.field_edits enable row level security;
alter table public.events enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.reading_quota enable row level security;

create policy workspaces_read on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy memberships_read on public.memberships
  for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'customers', 'products', 'product_aliases', 'documents', 'readings', 'orders',
    'order_lines', 'flags', 'field_edits', 'events', 'webhook_deliveries'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))',
      t || '_members', t
    );
  end loop;
end $$;

-- Functions -----------------------------------------------------------------------
-- Creates a fresh sandbox for the signed-in visitor, replacing any earlier one.
create or replace function public.create_workspace(p_story_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from public.workspaces w
    using public.memberships m
    where m.workspace_id = w.id and m.user_id = auth.uid();
  insert into public.workspaces (story_date) values (p_story_date) returning id into ws;
  insert into public.memberships (workspace_id, user_id) values (ws, auth.uid());
  return ws;
end $$;
revoke all on function public.create_workspace(date) from public;
grant execute on function public.create_workspace(date) to authenticated;

-- Counts one live reading against a per-sandbox and a site-wide daily limit.
create or replace function public.consume_reading_quota(p_ws uuid, p_ws_limit int, p_global_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare ws_count int; global_count int;
begin
  if not public.is_member(p_ws) then
    return false;
  end if;
  insert into public.reading_quota (day, scope) values (current_date, 'global') on conflict do nothing;
  insert into public.reading_quota (day, scope) values (current_date, p_ws::text) on conflict do nothing;
  select count into global_count from public.reading_quota where day = current_date and scope = 'global' for update;
  select count into ws_count from public.reading_quota where day = current_date and scope = p_ws::text for update;
  if global_count >= p_global_limit or ws_count >= p_ws_limit then
    return false;
  end if;
  update public.reading_quota set count = count + 1
    where day = current_date and scope in ('global', p_ws::text);
  return true;
end $$;
revoke all on function public.consume_reading_quota(uuid, int, int) from public;
grant execute on function public.consume_reading_quota(uuid, int, int) to authenticated;

create or replace function public.reading_quota_left(p_ws uuid, p_ws_limit int, p_global_limit int)
returns int language sql stable security definer set search_path = public as $$
  select case when not public.is_member(p_ws) then 0 else greatest(0, least(
    p_ws_limit - coalesce((select count from public.reading_quota where day = current_date and scope = p_ws::text), 0),
    p_global_limit - coalesce((select count from public.reading_quota where day = current_date and scope = 'global'), 0)
  )) end;
$$;
revoke all on function public.reading_quota_left(uuid, int, int) from public;
grant execute on function public.reading_quota_left(uuid, int, int) to authenticated;

-- Approves a draft order in one transaction. Runs with the caller's permissions,
-- so row-level security still applies.
create or replace function public.approve_order(p_order uuid, p_summary text)
returns void language plpgsql security invoker set search_path = public as $$
declare o public.orders; blockers int;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.status <> 'draft' then
    raise exception 'This order is already %', o.status;
  end if;
  select count(*) into blockers from public.flags
    where order_id = p_order and severity = 'blocker' and resolved_at is null;
  if blockers > 0 then
    raise exception 'Fix % item% first', blockers, case when blockers = 1 then '' else 's' end;
  end if;
  if o.customer_id is null or o.delivery_date is null then
    raise exception 'A café and a delivery date are needed before approving';
  end if;
  update public.flags set resolved_at = now(), resolution = 'Accepted as read on approval'
    where order_id = p_order and resolved_at is null;
  update public.orders set status = 'approved', approved_at = now() where id = p_order;
  if o.document_id is not null then
    update public.documents set status = 'approved' where id = o.document_id;
  end if;
  insert into public.events (workspace_id, type, summary, payload)
    values (o.workspace_id, 'order.approved', p_summary, jsonb_build_object('order_id', p_order));
end $$;
grant execute on function public.approve_order(uuid, text) to authenticated;

-- Storage: private bucket, one folder per workspace ----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv'])
on conflict (id) do nothing;

create policy uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy uploads_select on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_member(((storage.foldername(name))[1])::uuid));
