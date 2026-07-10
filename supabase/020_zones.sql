-- ============================================================
-- 020: ゾーンマスタ + 駅→ゾーンマップ
-- ============================================================
-- survey_responses は raw station だけを持ち、ゾーン解決はこのマップで行う。
-- generation を切り替えれば、過去回答を書き換えずに粒度を変更できる。

create table if not exists zones (
  id text not null,
  name text not null,
  generation integer not null default 1,
  created_at timestamptz default now(),
  primary key (id, generation)
);

create table if not exists station_zone_map (
  station text not null,
  generation integer not null default 1,
  zone_id text not null,
  created_at timestamptz default now(),
  primary key (station, generation),
  foreign key (zone_id, generation)
    references zones(id, generation)
    on update cascade
    on delete restrict
);

create index if not exists idx_station_zone_map_zone
  on station_zone_map(zone_id, generation);

insert into zones (id, name, generation) values
  ('shibuya', '渋谷', 1),
  ('shinjuku', '新宿', 1),
  ('ikebukuro', '池袋', 1),
  ('tokyo', '東京', 1),
  ('shinagawa', '品川', 1),
  ('ueno', '上野', 1),
  ('ginza', '銀座', 1),
  ('roppongi', '六本木', 1),
  ('ebisu', '恵比寿', 1),
  ('meguro', '目黒', 1),
  ('akihabara', '秋葉原', 1),
  ('asakusa', '浅草', 1),
  ('omotesando', '表参道', 1),
  ('shimokitazawa', '下北沢', 1),
  ('kichijoji', '吉祥寺', 1),
  ('tachikawa', '立川', 1),
  ('machida', '町田', 1),
  ('yokohama', '横浜', 1)
on conflict (id, generation) do update
set name = excluded.name;

insert into station_zone_map (station, zone_id, generation) values
  ('渋谷駅', 'shibuya', 1),
  ('新宿駅', 'shinjuku', 1),
  ('池袋駅', 'ikebukuro', 1),
  ('東京駅', 'tokyo', 1),
  ('品川駅', 'shinagawa', 1),
  ('上野駅', 'ueno', 1),
  ('銀座駅', 'ginza', 1),
  ('六本木駅', 'roppongi', 1),
  ('恵比寿駅', 'ebisu', 1),
  ('目黒駅', 'meguro', 1),
  ('秋葉原駅', 'akihabara', 1),
  ('浅草駅', 'asakusa', 1),
  ('表参道駅', 'omotesando', 1),
  ('下北沢駅', 'shimokitazawa', 1),
  ('吉祥寺駅', 'kichijoji', 1),
  ('立川駅', 'tachikawa', 1),
  ('町田駅', 'machida', 1),
  ('横浜駅', 'yokohama', 1)
on conflict (station, generation) do update
set zone_id = excluded.zone_id;

