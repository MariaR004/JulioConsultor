create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.site_settings (
  id text primary key,
  whatsapp text not null default '556596052977',
  phone text not null default '556636661989',
  email text not null default 'julioimoveis1@hotmail.com',
  updated_at timestamptz not null default now(),
  constraint whatsapp_length_check check (char_length(whatsapp) between 10 and 20),
  constraint phone_length_check check (char_length(phone) between 8 and 20),
  constraint email_length_check check (char_length(email) <= 100)
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  deal_type text not null check (deal_type in ('sale', 'rent')),
  price_cents integer,
  street text,
  number text,
  neighborhood text not null,
  city text not null default 'Cuiabá',
  state text not null default 'MT',
  postal_code text,
  bedrooms integer not null default 0 check (bedrooms >= 0),
  suites integer not null default 0 check (suites >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  parking_spaces integer not null default 0 check (parking_spaces >= 0),
  area_m2 numeric,
  description text,
  features text[] not null default '{}',
  solar_kwh_month integer,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suites_lte_bedrooms check (suites <= bedrooms),
  constraint title_length_check check (char_length(title) <= 120),
  constraint street_length_check check (street is null or char_length(street) <= 150),
  constraint number_length_check check (number is null or char_length(number) <= 20),
  constraint neighborhood_length_check check (char_length(neighborhood) <= 80),
  constraint city_length_check check (char_length(city) <= 80),
  constraint state_length_check check (char_length(state) = 2),
  constraint postal_code_length_check check (postal_code is null or char_length(postal_code) <= 15),
  constraint description_length_check check (description is null or char_length(description) <= 6000),
  constraint features_array_check check (cardinality(features) <= 25)
);

create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  card_path text,
  full_path text,
  alt text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.property_photos
  add column if not exists thumb_path text,
  add column if not exists card_path text,
  add column if not exists full_path text;

-- ============ Slug legível para a URL do imóvel ============
-- Gera um slug a partir do título: minúsculo, sem acentos e com hífens.
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(
          coalesce(value, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
        )),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

alter table public.properties add column if not exists slug text;

-- Preenche os imóveis já cadastrados (somente onde o slug ainda está vazio),
-- resolvendo títulos repetidos com sufixo numérico estável por data de criação.
with ranked as (
  select
    id,
    coalesce(nullif(public.slugify(title), ''), 'imovel') as base,
    row_number() over (
      partition by coalesce(nullif(public.slugify(title), ''), 'imovel')
      order by created_at, id
    ) as rn
  from public.properties
)
update public.properties p
set slug = case when ranked.rn = 1 then ranked.base else ranked.base || '-' || ranked.rn end
from ranked
where p.id = ranked.id and p.slug is null;

create unique index if not exists properties_slug_key
  on public.properties (slug) where slug is not null;

-- Mantém o slug em dia: gera na inserção e quando o título muda; resolve colisões.
create or replace function public.properties_set_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  -- Em updates que não mexem no título, preserva o slug atual (links estáveis).
  if tg_op = 'UPDATE' and new.slug is not null and new.title is not distinct from old.title then
    new.slug := old.slug;
    return new;
  end if;

  base_slug := coalesce(nullif(public.slugify(new.title), ''), 'imovel');
  candidate := base_slug;
  while exists (
    select 1 from public.properties p where p.slug = candidate and p.id <> new.id
  ) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists properties_set_slug on public.properties;
create trigger properties_set_slug
before insert or update on public.properties
for each row
execute function public.properties_set_slug();

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop policy if exists "Public can read published properties" on public.properties;
drop policy if exists "Public can read published property photos" on public.property_photos;
drop policy if exists "Public can read property photo objects" on storage.objects;
drop index if exists public.properties_public_idx;
alter table public.properties drop column if exists published;
create index if not exists properties_public_idx on public.properties (is_featured desc, sort_order, created_at desc);
create index if not exists property_photos_property_idx on public.property_photos (property_id, position);
create unique index if not exists properties_single_featured_idx on public.properties (is_featured) where is_featured = true;
create index if not exists admin_audit_events_created_idx on public.admin_audit_events (created_at desc);
create index if not exists admin_audit_events_actor_idx on public.admin_audit_events (actor_user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_touch_updated_at on public.properties;
create trigger properties_touch_updated_at
before update on public.properties
for each row
execute function public.touch_updated_at();

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
before update on public.site_settings
for each row
execute function public.touch_updated_at();

insert into public.site_settings (id, whatsapp, phone, email)
values ('contact', '556596052977', '556636661989', 'julioimoveis1@hotmail.com')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.admin_usage_summary()
returns table (
  database_used_bytes bigint,
  database_limit_bytes bigint,
  bucket_used_bytes bigint,
  bucket_limit_bytes bigint,
  bucket_file_count bigint
)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  free_database_limit_bytes constant bigint := 524288000;
  free_bucket_limit_bytes constant bigint := 1073741824;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with bucket_usage as (
    select
      count(*)::bigint as file_count,
      coalesce(sum(
        case
          when metadata ? 'size' and (metadata ->> 'size') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint
          else 0
        end
      ), 0)::bigint as used_bytes
    from storage.objects
    where bucket_id = 'property-photos'
  )
  select
    pg_database_size(current_database())::bigint,
    free_database_limit_bytes,
    bucket_usage.used_bytes,
    free_bucket_limit_bytes,
    bucket_usage.file_count
  from bucket_usage;
end;
$$;

revoke all on function public.admin_usage_summary() from public;
grant execute on function public.admin_usage_summary() to authenticated;

alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.properties enable row level security;
alter table public.property_photos enable row level security;
alter table public.admin_audit_events enable row level security;

drop policy if exists "Admins can read themselves" on public.admin_users;
create policy "Admins can read themselves"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read audit events" on public.admin_audit_events;
create policy "Admins can read audit events"
on public.admin_audit_events
for select
to authenticated
using (public.is_admin());

revoke insert, update, delete on table public.admin_audit_events from anon, authenticated;
grant select on table public.admin_audit_events to authenticated;

drop policy if exists "Public can read contact settings" on public.site_settings;
create policy "Public can read contact settings"
on public.site_settings
for select
to anon, authenticated
using (id = 'contact');

drop policy if exists "Admins manage contact settings" on public.site_settings;
create policy "Admins manage contact settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published properties" on public.properties;
drop policy if exists "Public can read properties" on public.properties;
create policy "Public can read properties"
on public.properties
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage properties" on public.properties;
create policy "Admins manage properties"
on public.properties
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published property photos" on public.property_photos;
drop policy if exists "Public can read property photos" on public.property_photos;
create policy "Public can read property photos"
on public.property_photos
for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage property photos" on public.property_photos;
create policy "Admins manage property photos"
on public.property_photos
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read property photo objects" on storage.objects;

drop policy if exists "Admins list property photo objects" on storage.objects;
create policy "Admins list property photo objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'property-photos' and public.is_admin());

drop policy if exists "Admins upload property photo objects" on storage.objects;
create policy "Admins upload property photo objects"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'property-photos' and public.is_admin());

drop policy if exists "Admins update property photo objects" on storage.objects;
create policy "Admins update property photo objects"
on storage.objects
for update
to authenticated
using (bucket_id = 'property-photos' and public.is_admin())
with check (bucket_id = 'property-photos' and public.is_admin());

drop policy if exists "Admins delete property photo objects" on storage.objects;
create policy "Admins delete property photo objects"
on storage.objects
for delete
to authenticated
using (bucket_id = 'property-photos' and public.is_admin());
