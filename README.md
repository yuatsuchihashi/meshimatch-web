## MeshiMatch Web

MeshiMatch is a group decision support app for deciding where to meet and which restaurant to choose together.

This repo is the current web app built with Next.js and Supabase. Candidates come only from the trust rings (members' favorites, connections' public favorites, verified official lists) — no external restaurant search. The current version supports:

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
3. Build the candidate pool from trusted recommendations (no external search API).
4. Rank restaurants with logic-based scoring.
5. Show reason tags and one-line explanations without LLM-generated copy.

## Notes

- The app keeps backward compatibility with legacy tier-based survey fields while treating the newer v2 fields as the main path.
- Current development preview can be run locally and verified with `test`, `lint`, and `build`.

## Instant Pilot

The current 30–50 restaurant experiment is defined in
[`docs/instant-pilot-v0.1.md`](docs/instant-pilot-v0.1.md). Add human-verified
restaurants to `data/pilot-restaurants.csv`, validate with
`npm run pilot:validate`, then import to the local store with
`npm run pilot:import-local`. The importer never writes to remote Supabase.

### Menu-aware local instant flow

With `MESHIMATCH_LOCAL_MODE=1 NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE=1 npm run dev`,
open `/instant` to choose a meal or café visit, then try the area-based survey
and unanimous vote in the native app.
The complete fictional catalog contains 33 shops and 94 menu items around fixed
meeting points in Shinjuku and Buenos Aires. `src/lib/instant/discovery.ts`
contains the taxonomy, menu-level constraints and scoring. The React flow uses
the existing `/instant`, `/instant/round`, `/instant/top3` and `/instant/ticket`
routes. Answers and voting progress remain in versioned session storage in the
current tab. Reloads return private answering and voting screens to their cover.

For the café questionnaire prototype, open `/instant?mode=cafe`. The three
optional steps separately collect food wishes, venue preferences and total
visit budget or dietary requirements. Food wishes retain their strength, while
venue preferences cover atmosphere, reputation, distance and price. Café scoring uses feasible order
combinations, including mandatory drinks and seat charges. Its weights and
review-count adjustment are provisional settings for user testing.
Candidate reactions distinguish approval, more information and rejection.
Information requests can be revisited without being counted as approvals.
Rejections with price or distance reasons influence the next suggestions while
hard constraints remain explicit. The atmosphere question uses AI-generated reference interiors. Individual café
photos are currently unregistered.

For restaurants, open `/instant?mode=restaurant`. The three optional steps
collect cuisine or dish wishes, venue preferences, and per-person dish budget
or dietary and heat constraints. Restaurant venue preferences cover sound level, estimated entry wait, review
rating, distance and price. Sound-level preferences accept multiple values
(quiet, moderate or lively), while a shorter entry wait is an optional ranking
preference. Wait estimates in this catalog are synthetic fixtures. The café's visual ambience question is specific
to the café flow.
Italian restaurants and pizzerias match their independent Google Places type
IDs. Pasta is a separate menu-based choice, including Japanese-style pasta
shops without an Italian place type. A fictional Japanese-style pasta shop
is included to exercise this distinction. The catalog and its type assignments
remain synthetic fixtures.
Review comparison adjusts the average star rating using the review count and
a provisional prior of 4.2 stars with weight 30. The questionnaire explains
this experimental setting when review rating is selected.

Restaurant conversation scenarios in `src/lib/instant/discovery.test.ts` hold
other attributes fixed and compare a quiet conversation, a lively group meal,
acceptable sound-level alternatives, avoiding queues, accepting a wait for
higher reviews, and no stated environmental preference. They check algorithm
behavior under the stated assumptions; the scenarios are hypothetical.
