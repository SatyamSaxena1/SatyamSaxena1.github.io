-- "Burrs": public, live comments pinned to a spot on the page (blinkedit.me only).
-- Everything is publicly readable on purpose. Anonymous visitors can only INSERT
-- a plain comment; replies, plucking and reveals are done by the owner.

create table if not exists public.burrs (
  id          uuid primary key default gen_random_uuid(),
  page        text not null check (char_length(page) between 1 and 200),
  x           numeric not null check (x between 0 and 1),        -- fraction of page width
  y           integer not null check (y between 0 and 100000),   -- px from top of page
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  name        text check (name is null or char_length(name) <= 80),
  linkedin    text check (linkedin is null or linkedin ~ '^https://([a-z0-9-]+\.)?linkedin\.com/'),
  reply       text check (reply is null or char_length(reply) <= 2000),
  replied_at  timestamptz,
  plucked_at  timestamptz,     -- body is kept: the "ghost" of a plucked burr says what it said
  created_at  timestamptz not null default now()
);

alter table public.burrs enable row level security;

create policy "burrs are public" on public.burrs
  for select to anon, authenticated using (true);

create policy "anyone can leave a plain burr" on public.burrs
  for insert to anon, authenticated
  with check (reply is null and replied_at is null and plucked_at is null
              and name is null and linkedin is null);
-- No update/delete policies: only the owner (service role / dashboard) can reply or pluck.

-- Flood guard that doesn't need to store anything about visitors:
-- at most 40 new burrs per 10 minutes across the whole site.
create or replace function public.burrs_flood_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.burrs where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'too many burrs right now, try again in a bit';
  end if;
  return new;
end $$;

create trigger burrs_flood_guard before insert on public.burrs
  for each row execute function public.burrs_flood_guard();

alter publication supabase_realtime add table public.burrs;
