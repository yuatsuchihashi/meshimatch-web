-- ============================================================
-- 007: ○× 投票 (候補カード方式)
-- ============================================================
-- 候補レストランに対する各メンバーの ○/× を保存する。
-- 「誰がどっちに入れたか」はサービスだけが見る (集計のみ公開)。
-- ============================================================

create table if not exists restaurant_votes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references group_members(id) on delete cascade,
  restaurant_id text not null,   -- 台帳 restaurants.id (uuid) を text で保持
  restaurant_name text,          -- 表示用スナップショット
  genre_id text,
  vote text not null check (vote in ('yes', 'no')),
  created_at timestamptz default now(),
  unique (group_id, member_id, restaurant_id)
);

create index if not exists idx_restaurant_votes_group on restaurant_votes (group_id);
