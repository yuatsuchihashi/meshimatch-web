-- ============================================================
-- MeshiMatch – Auth & RLS Policies (v1.1)
-- ============================================================
-- 認証有効化: profiles.id = auth.uid() で紐付け
-- 開発用の全開放ポリシーを削除し、適切なRLSに置き換え
-- ============================================================

-- 1. 開発用ポリシーを削除
drop policy if exists "dev_all_profiles" on profiles;
drop policy if exists "dev_all_groups" on groups;
drop policy if exists "dev_all_group_members" on group_members;
drop policy if exists "dev_all_survey_responses" on survey_responses;
drop policy if exists "dev_all_decisions" on decisions;
drop policy if exists "dev_all_invitations" on invitations;
drop policy if exists "dev_all_follows" on follows;

-- ============================================
-- profiles: 自分のは読み書き可、他人のは読み取りのみ
-- ============================================
create policy "profiles_select_all"
  on profiles for select
  using (true);

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid());

-- ============================================
-- groups: 全員が閲覧可。作成は認証済みユーザー。
-- ============================================
create policy "groups_select_all"
  on groups for select
  using (true);

create policy "groups_insert_auth"
  on groups for insert
  with check (auth.uid() is not null);

create policy "groups_update_creator"
  on groups for update
  using (created_by = auth.uid());

-- ============================================
-- group_members: グループメンバーは閲覧可。自分の参加は自分で。
-- ============================================
create policy "group_members_select_all"
  on group_members for select
  using (true);

create policy "group_members_insert_auth"
  on group_members for insert
  with check (auth.uid() is not null);

create policy "group_members_update_own"
  on group_members for update
  using (profile_id = auth.uid());

-- ============================================
-- survey_responses: グループメンバーは閲覧可。自分の回答は自分で管理。
-- ============================================
create policy "survey_select_all"
  on survey_responses for select
  using (true);

create policy "survey_insert_auth"
  on survey_responses for insert
  with check (auth.uid() is not null);

create policy "survey_update_own"
  on survey_responses for update
  using (
    member_id in (
      select id from group_members where profile_id = auth.uid()
    )
  );

-- ============================================
-- decisions: 全員閲覧可。グループ作成者が決定。
-- ============================================
create policy "decisions_select_all"
  on decisions for select
  using (true);

create policy "decisions_insert_auth"
  on decisions for insert
  with check (auth.uid() is not null);

create policy "decisions_update_auth"
  on decisions for update
  using (auth.uid() is not null);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'area_catalog'
  ) then
    execute 'drop policy if exists "dev_all_area_catalog" on area_catalog';
    execute '
      create policy "area_catalog_select_all"
      on area_catalog for select
      using (true)
    ';
  end if;
end $$;

-- ============================================
-- invitations: 関係者のみ
-- ============================================
create policy "invitations_select_related"
  on invitations for select
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
  );

create policy "invitations_insert_auth"
  on invitations for insert
  with check (auth.uid() is not null);

create policy "invitations_update_related"
  on invitations for update
  using (
    inviter_id = auth.uid()
    or invitee_id = auth.uid()
  );

-- ============================================
-- follows: 自分のフォロー関係は管理可。全員閲覧可。
-- ============================================
create policy "follows_select_all"
  on follows for select
  using (true);

create policy "follows_insert_own"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "follows_delete_own"
  on follows for delete
  using (follower_id = auth.uid());
