-- ============================================================
-- 015: グループモード (即時 / 計画)
-- ============================================================
-- 既存フローは計画モードとして扱う。

alter table groups add column if not exists mode text;

update groups
set mode = 'planned'
where mode is null;

alter table groups
  alter column mode set default 'planned',
  alter column mode set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'groups_mode_check'
  ) then
    alter table groups
      add constraint groups_mode_check
      check (mode in ('instant', 'planned'));
  end if;
end $$;

