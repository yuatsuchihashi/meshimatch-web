-- ============================================================
-- 014: 手動追加店 (座標なしでも登録できるように)
-- ============================================================
-- 「行きたい店ある？」で検索に出ない店を名前だけで追加する用。
-- 座標は後から Places 照合で埋まる可能性がある。

alter table restaurants alter column lat drop not null;
alter table restaurants alter column lng drop not null;
