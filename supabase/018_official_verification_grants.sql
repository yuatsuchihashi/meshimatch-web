-- ============================================================
-- 018: 公式アカウント認証グラント
-- ============================================================
-- v1 は Kai/運営による手動付与。将来の自動/半自動判断に必要な
-- 採用率・決定貢献数などの実績指標は、既存の /api/events 計測基盤や
-- restaurant_sources / decisions / votes から集計できるためここでは持たない。

create table if not exists official_verification_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references profiles(id) on delete set null,
  note text,
  created_at timestamptz default now(),
  unique (profile_id)
);

create index if not exists idx_official_verification_grants_profile
  on official_verification_grants(profile_id);

comment on table official_verification_grants is
  'Manual blue-badge verification grants. Metrics are aggregated later from existing events and recommendation/vote records.';

