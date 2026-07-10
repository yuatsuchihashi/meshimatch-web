-- ============================================================
-- MeshiMatch – Database Schema (v1)
-- ============================================================
-- v1: 認証なし。全テーブル開放ポリシーで開発。
-- v2: Supabase Auth有効化 → profiles.id を auth.users(id) に紐付け
-- ============================================================

-- 既存テーブルを削除（開発用。本番では使わない）
drop table if exists invitations cascade;
drop table if exists decisions cascade;
drop table if exists survey_responses cascade;
drop table if exists group_members cascade;
drop table if exists groups cascade;
drop table if exists area_catalog cascade;
drop table if exists follows cascade;
drop table if exists favorite_restaurants cascade;
drop table if exists search_history cascade;
drop table if exists dietary_restrictions cascade;
drop table if exists genre_preferences cascade;
drop table if exists profiles cascade;

-- トリガーも削除
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- ============================================
-- 1. プロフィール
-- ============================================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null default 'ユーザー',
  allergies text[] default '{}',
  usual_budget_ideal_yen integer,
  usual_budget_max_yen integer,
  usual_budget_priority text
    check (usual_budget_priority in ('must', 'prefer', 'optional')),
  usual_areas text[] default '{}',
  favorite_genres jsonb not null default '[]'::jsonb,
  disliked_items text[] default '{}',
  dietary_restrictions jsonb not null default '[]'::jsonb,
  avatar_url text,
  usual_departure_station text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 2. グループ
-- ============================================
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  scheduled_at timestamptz,
  group_size integer,
  session_atmosphere text
    check (session_atmosphere in ('casual', 'polished', 'lively', 'calm')),
  session_focus text not null default 'balanced'
    check (session_focus in ('drink_centered', 'food_centered', 'balanced')),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 3. グループメンバー
-- ============================================
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  profile_id uuid references profiles(id),
  display_name text not null,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  has_survey boolean default false,
  joined_at timestamptz default now(),
  unique(group_id, profile_id)
);

-- ============================================
-- 4. サーベイ回答
-- ============================================
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  response_version integer not null default 2,
  departure_area text,
  departure_station text,
  preferred_areas text[] default '{}',
  budget_ideal_yen integer,
  budget_max_yen integer,
  budget_priority text
    check (budget_priority in ('must', 'prefer', 'optional')),
  genre_preferences jsonb not null default '[]'::jsonb,
  dietary_restrictions jsonb not null default '[]'::jsonb,
  submitted_at timestamptz default now(),
  unique(group_id, member_id)
);

-- ============================================
-- 5. レストラン決定
-- ============================================
create table decisions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid unique not null references groups(id) on delete cascade,
  restaurant_name text not null,
  restaurant_id text,
  genre_id text,
  decided_by uuid references profiles(id),
  decided_at timestamptz default now()
);

-- ============================================
-- 6. エリアメタデータ
-- ============================================
create table area_catalog (
  id text primary key,
  display_name text not null unique,
  station_name text not null,
  area_kind text not null default 'district'
    check (area_kind in ('district', 'hub', 'discovery')),
  prefecture text not null default 'Tokyo',
  hub_score numeric(4,3) not null default 0
    check (hub_score >= 0 and hub_score <= 1),
  supply_score numeric(4,3) not null default 0
    check (supply_score >= 0 and supply_score <= 1),
  nightlife_score numeric(4,3) not null default 0
    check (nightlife_score >= 0 and nightlife_score <= 1),
  discovery_score numeric(4,3) not null default 0
    check (discovery_score >= 0 and discovery_score <= 1),
  reliability_score numeric(4,3) not null default 0
    check (reliability_score >= 0 and reliability_score <= 1),
  nearby_hubs text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 7. 招待
-- ============================================
create table invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  inviter_id uuid references profiles(id),
  invitee_id uuid references profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now()
);

-- ============================================
-- 8. 繋がり (フォロー)
-- ============================================
create table follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

-- ============================================
-- インデックス
-- ============================================
create index idx_group_members_group on group_members(group_id);
create index idx_group_members_profile on group_members(profile_id);
create index idx_survey_responses_group on survey_responses(group_id);
create index idx_survey_responses_member on survey_responses(member_id);
create index idx_area_catalog_display_name on area_catalog(display_name);
create index idx_invitations_invitee on invitations(invitee_id);
create index idx_invitations_group on invitations(group_id);
create index idx_groups_invite_code on groups(invite_code);
create index idx_follows_follower on follows(follower_id);
create index idx_follows_following on follows(following_id);

-- ============================================
-- updated_at 自動更新トリガー
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger groups_updated_at
  before update on groups
  for each row execute function update_updated_at();

create trigger area_catalog_updated_at
  before update on area_catalog
  for each row execute function update_updated_at();

-- ============================================
-- RLS: 開発用に全アクセス許可
-- v2で認証有効化時に適切なポリシーに書き換え
-- ============================================
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table survey_responses enable row level security;
alter table decisions enable row level security;
alter table area_catalog enable row level security;
alter table invitations enable row level security;
alter table follows enable row level security;

create policy "dev_all_profiles" on profiles for all using (true) with check (true);
create policy "dev_all_groups" on groups for all using (true) with check (true);
create policy "dev_all_group_members" on group_members for all using (true) with check (true);
create policy "dev_all_survey_responses" on survey_responses for all using (true) with check (true);
create policy "dev_all_decisions" on decisions for all using (true) with check (true);
create policy "dev_all_area_catalog" on area_catalog for all using (true) with check (true);
create policy "dev_all_invitations" on invitations for all using (true) with check (true);
create policy "dev_all_follows" on follows for all using (true) with check (true);
