-- ============================================================
-- 006: 台帳 (gazetteer) + 信頼レイヤー
-- ============================================================
-- restaurants: 店の事実情報のみ (Overture/FSQ 由来 + 手動)
-- restaurant_sources: 「なぜこの店が候補に値するか」を店と分離して持つ
--   base_curated  : 運営/インフルエンサー由来の初期データ (デフォルト母集団)
--   endorsement   : 許可を得た発信者の推薦 ("〇〇のおすすめ！" バッジ表示)
--   user_favorite : ユーザーのお気に入り (Google Maps インポート含む)
--     visibility=public にすると全ユーザーの候補プールに入る
-- ============================================================

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_en text,
  lat double precision not null,
  lng double precision not null,
  nearest_area text,          -- SURVEY_AREAS のいずれか (候補エリアとの対応)
  genre_id text,              -- 既存のジャンルID体系 (G001..)
  price_band text,            -- "~2000" | "2000-4000" | "4000-6000" | "6000+"
  address text,
  url text,
  photo_url text,
  closed boolean not null default false,
  external_id text unique,    -- "overture:<id>" | "fsq:<id>" | "manual:<slug>"
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_restaurants_area on restaurants (nearest_area) where closed = false;

create table if not exists restaurant_sources (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  source_type text not null
    check (source_type in ('base_curated', 'endorsement', 'user_favorite')),
  visibility text not null default 'private'
    check (visibility in ('public', 'private')),
  added_by uuid references profiles(id),
  display_label text,         -- "〇〇のおすすめ！" (本人が許可した場合のみ)
  note text,                  -- なぜ良いか (内部メモ)
  created_at timestamptz default now(),
  unique (restaurant_id, source_type, added_by)
);

create index if not exists idx_restaurant_sources_restaurant on restaurant_sources (restaurant_id);
