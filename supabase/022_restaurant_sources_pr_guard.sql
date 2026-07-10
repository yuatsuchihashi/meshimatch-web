-- ============================================================
-- 022: restaurant_sources PR 開示フラグの公式アカウントガード
-- ============================================================
-- PR 開示は公式認証済みアカウントだけが true にできる。
-- UI/RLS の経路に依存せず、insert/update 時に added_by を台帳で再確認する。

create or replace function enforce_restaurant_sources_pr_guard()
returns trigger
language plpgsql
as $$
begin
  if new.pr is true and (
    new.added_by is null or not exists (
      select 1
      from official_verification_grants
      where profile_id = new.added_by
    )
  ) then
    new.pr := false;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurant_sources_pr_guard on restaurant_sources;

create trigger restaurant_sources_pr_guard
before insert or update on restaurant_sources
for each row
execute function enforce_restaurant_sources_pr_guard();

comment on function enforce_restaurant_sources_pr_guard() is
  'Coerces restaurant_sources.pr to false unless added_by has an official verification grant.';
