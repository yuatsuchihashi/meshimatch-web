-- ============================================================
-- 024: Pilot restaurant contact/access facts
-- ============================================================
-- Human-curated pilot rows need a call action and a concise access label.
-- These are factual restaurant fields; recommendation provenance remains in
-- restaurant_sources.

alter table restaurants
  add column if not exists phone_number text,
  add column if not exists access_note text;

comment on column restaurants.phone_number is
  'Restaurant phone number supplied by a member, official curator, or approved import.';
comment on column restaurants.access_note is
  'Human-readable access note such as 渋谷駅徒歩6分. Not a live travel-time claim.';
