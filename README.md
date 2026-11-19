# MeshiMatch Web

グループの食事会で、参加者の希望を集めて行く店を決めるWebアプリ。

## 開発を再開するときに

| 版 | 内容 | 場所 |
| --- | --- | --- |
| グループ推薦版 | 招待リンクで希望を集め、集合エリアとHotPepperの店舗候補を提案する。以下の開発手順はこの版が対象。 | このリポジトリの `main` |
| 2026年8月の即時モード実験 v0.1 | 2〜8人でスマホを回し、3店に匿名投票して1店を決める実験。 | 11月19日時点ではローカルの `v2-ui-refresh` 作業ツリー。仕様はその中の `docs/instant-pilot-v0.1.md` |
| 2026年7月のBuild Weekデモ | QR・ルームコードで各自の端末から参加する提出版。 | [デモのブランチ](https://github.com/yuatsuchihashi/meshimatch-web/tree/codex/3d-gathered-instant) |

サービスの紹介と事前登録は [meshimatch.com](https://meshimatch.com/)。

## Features on main

- group creation and invite flow
- guest and member survey flows
- partial-response friendly recommendation logic
- top 3 candidate meeting areas
- restaurant ranking with budget, genre, atmosphere, focus, and restriction signals
- structured reason tags and explanation text

## Local Development

Run the development server:

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Useful commands:

```bash
npm test
npm run lint
npm run build
```

## Stack

- Next.js 16 / React 19 / TypeScript
- Supabase Auth + Postgres
- HotPepper Gourmet Search API
- dnd-kit for preference sorting UI

## Data Model Highlights

- `groups`: session-level settings like date/time, atmosphere, focus, group size
- `group_members`: membership and answer status
- `survey_responses`: departure area/station, preferred areas, budget, genre preferences, dislikes, restrictions
- `profiles`: member defaults such as budget, usual areas, favorite genres, dietary restrictions
- `decisions`: selected restaurant for a group

## Recommendation Flow

1. Collect session inputs and any participant responses.
2. Generate and score candidate meeting areas.
3. Fetch restaurants mainly through HotPepper API.
4. Rank restaurants with logic-based scoring.
5. Show reason tags and one-line explanations without LLM-generated copy.

## Notes

- The app keeps backward compatibility with legacy tier-based survey fields while treating the newer v2 fields as the main path.
- Current development preview can be run locally and verified with `test`, `lint`, and `build`.
