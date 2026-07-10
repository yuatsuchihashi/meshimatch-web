-- ============================================================
-- 016: アンケート出発駅 (raw station)
-- ============================================================
-- 駅ピッカーの選択値をそのまま保存する。ジオ座標は保存しない。
-- ゾーン解決はランキング時に station_zone_map で行う。

alter table survey_responses
  add column if not exists departure_station text;

comment on column survey_responses.departure_station is
  'Raw station picked by the user. Never stores geo coordinates; zone resolution happens at query/ranking time.';

