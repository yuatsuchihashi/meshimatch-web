## MeshiMatch Web

MeshiMatch is a group decision support app for deciding where to meet and which restaurant to choose together.

This repo is the current web app built with Next.js, Supabase, and HotPepper API. The current version supports:

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
- Supabase Auth + Postgres (or local JSON store via `MESHIMATCH_LOCAL_MODE=1` — no Supabase needed)
- Own restaurant gazetteer (Overture Maps derived, ~35k Tokyo restaurants across 10 areas)
  + trust layer (`base_curated` / `endorsement` / `user_favorite`) — HotPepper is no longer the recommendation source
- Google Maps shared-list import for favorites (`src/lib/gmaps-import/`, isolated & fallback-ready)
- ○× card voting (`restaurant_votes`) for the group decision step
- dnd-kit for preference sorting UI
- Design system: `DESIGN.md` (palette, typography, components, do's & don'ts)

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
