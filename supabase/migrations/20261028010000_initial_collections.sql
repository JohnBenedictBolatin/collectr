create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Collector' check (char_length(display_name) <= 80),
  reduce_mascot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('Funko Pop', 'Action Figure', 'Card', 'Other')),
  brand text not null default '' check (char_length(brand) <= 100),
  franchise text not null default '' check (char_length(franchise) <= 100),
  condition text not null default 'Not set' check (char_length(condition) <= 60),
  tags text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 2000),
  acquired_at date,
  is_favorite boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index items_owner_created_idx on public.items(owner_id, created_at desc);
create index items_owner_category_idx on public.items(owner_id, category);
create index items_tags_idx on public.items using gin(tags);
create trigger items_set_updated_at before update on public.items for each row execute function public.set_updated_at();

create table public.item_collections (
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  collection_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (item_id, collection_id),
  foreign key (item_id, owner_id) references public.items(id, owner_id) on delete cascade,
  foreign key (collection_id, owner_id) references public.collections(id, owner_id) on delete cascade
);
create index item_collections_by_collection on public.item_collections(owner_id, collection_id, item_id);

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  storage_path text not null unique,
  sort_order smallint not null check (sort_order between 0 and 4),
  created_at timestamptz not null default now(),
  unique (item_id, sort_order),
  foreign key (item_id, owner_id) references public.items(id, owner_id) on delete cascade
);
create index item_photos_owner_item on public.item_photos(owner_id, item_id);

create table public.cabinets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create trigger cabinets_set_updated_at before update on public.cabinets for each row execute function public.set_updated_at();

create table public.cabinet_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  cabinet_id uuid not null,
  row_index smallint not null check (row_index between 0 and 11),
  slots_count smallint not null default 4 check (slots_count between 1 and 12),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (cabinet_id, row_index),
  foreign key (cabinet_id, owner_id) references public.cabinets(id, owner_id) on delete cascade
);

create table public.placements (
  item_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  row_id uuid not null,
  slot_index smallint not null check (slot_index between 0 and 11),
  updated_at timestamptz not null default now(),
  unique (row_id, slot_index),
  foreign key (item_id, owner_id) references public.items(id, owner_id) on delete cascade,
  foreign key (row_id, owner_id) references public.cabinet_rows(id, owner_id) on delete cascade
);
create trigger placements_set_updated_at before update on public.placements for each row execute function public.set_updated_at();
create index placements_owner_row on public.placements(owner_id, row_id, slot_index);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Collector'))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_user();

create or replace function public.move_item(
  p_item_id uuid,
  p_cabinet_id uuid,
  p_row_index smallint,
  p_slot_index smallint,
  p_expected_updated_at timestamptz default null
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_owner_id uuid := auth.uid();
  v_row_id uuid;
  v_current_updated_at timestamptz;
begin
  if v_owner_id is null then raise exception 'Sign in to move collectibles.'; end if;
  if not exists (select 1 from public.items i where i.id = p_item_id and i.owner_id = v_owner_id) then
    raise exception 'This collectible is not available.';
  end if;

  if p_cabinet_id is null then
    if p_expected_updated_at is not null then
      select p.updated_at into v_current_updated_at from public.placements p where p.item_id = p_item_id and p.owner_id = v_owner_id for update;
      if v_current_updated_at is distinct from p_expected_updated_at then raise exception 'STALE_PLACEMENT'; end if;
    end if;
    delete from public.placements p where p.item_id = p_item_id and p.owner_id = v_owner_id;
    return;
  end if;

  if p_row_index is null or p_slot_index is null or p_row_index not between 0 and 11 or p_slot_index not between 0 and 11 then
    raise exception 'Choose a valid shelf row and slot.';
  end if;
  select r.id into v_row_id from public.cabinet_rows r
    where r.owner_id = v_owner_id and r.cabinet_id = p_cabinet_id and r.row_index = p_row_index and r.slots_count > p_slot_index;
  if v_row_id is null then raise exception 'Choose an available shelf slot.'; end if;

  select p.updated_at into v_current_updated_at from public.placements p where p.item_id = p_item_id and p.owner_id = v_owner_id for update;
  if p_expected_updated_at is not null and v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_PLACEMENT';
  end if;

  insert into public.placements(item_id, owner_id, row_id, slot_index)
  values (p_item_id, v_owner_id, v_row_id, p_slot_index)
  on conflict (item_id) do update set row_id = excluded.row_id, slot_index = excluded.slot_index, updated_at = now();
exception when unique_violation then
  raise exception 'SLOT_OCCUPIED';
end;
$$;
revoke all on function public.move_item(uuid, uuid, smallint, smallint, timestamptz) from public;
grant execute on function public.move_item(uuid, uuid, smallint, smallint, timestamptz) to authenticated;

create or replace function public.resize_cabinet_slots(p_cabinet_id uuid, p_slots_count smallint)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_owner_id uuid := auth.uid();
  v_displaced integer := 0;
begin
  if v_owner_id is null then raise exception 'Sign in to update your cabinet.'; end if;
  if p_slots_count not between 1 and 12 then raise exception 'Choose between one and twelve shelf spots.'; end if;
  perform 1 from public.cabinets c where c.id = p_cabinet_id and c.owner_id = v_owner_id for update;
  if not found then raise exception 'This cabinet is not available.'; end if;
  delete from public.placements p using public.cabinet_rows r
    where p.row_id = r.id and r.cabinet_id = p_cabinet_id and r.owner_id = v_owner_id and p.slot_index >= p_slots_count;
  get diagnostics v_displaced = row_count;
  update public.cabinet_rows set slots_count = p_slots_count where cabinet_id = p_cabinet_id and owner_id = v_owner_id;
  return v_displaced;
end;
$$;
revoke all on function public.resize_cabinet_slots(uuid, smallint) from public;
grant execute on function public.resize_cabinet_slots(uuid, smallint) to authenticated;

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.items enable row level security;
alter table public.item_collections enable row level security;
alter table public.item_photos enable row level security;
alter table public.cabinets enable row level security;
alter table public.cabinet_rows enable row level security;
alter table public.placements enable row level security;

create policy "profile owner" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "collection owner" on public.collections for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "item owner" on public.items for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "membership owner" on public.item_collections for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "photo owner" on public.item_photos for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "cabinet owner" on public.cabinets for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "row owner" on public.cabinet_rows for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "placement owner" on public.placements for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('collectible-photos', 'collectible-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

create policy "private photo owner read" on storage.objects for select to authenticated
  using (bucket_id = 'collectible-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private photo owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'collectible-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "private photo owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'collectible-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
