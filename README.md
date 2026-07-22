## MeshiMatch Web

MeshiMatch is a group decision support app for deciding where to meet and which restaurant to choose together.

## OpenAI Build Week submission

MeshiMatch turns the awkward question “Where should we eat?” into a shared spatial experience. It supports two different moments:

- **Plan later — Dining Plaza:** every picnic table on the home lawn represents a real upcoming meal. People approach a table, take a seat, and continue planning together.
- **Eat now — 30-second table:** one person summons a live table, friends join by QR or room code, and the host participates too. Each person privately throws one **Wish** and one optional **Avoid** onto the table. The room combines those signals into one nearby restaurant, allows a single anonymous objection, and delivers the same dinner ticket to every device.

The Build Week implementation lives on the [`codex/3d-gathered-instant`](https://github.com/yuatsuchihashi/meshimatch-web/tree/codex/3d-gathered-instant) branch.

Demo video: [MeshiMatch — OpenAI Build Week](https://www.youtube.com/watch?v=4fqKzZwRC-s) (1:54, English narration and captions)

### Run the Build Week experience

```bash
git clone https://github.com/yuatsuchihashi/meshimatch-web.git
cd meshimatch-web
git switch codex/3d-gathered-instant
npm install

cat > .env.local <<'EOF'
MESHIMATCH_LOCAL_MODE=1
NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE=1
EOF

npm run dev
```

Open `http://127.0.0.1:3000` for the Dining Plaza or `http://127.0.0.1:3000/instant` for Eat now. Local mode uses the repository’s JSON-backed demo data, so judges do not need Supabase credentials.

### How Codex and GPT-5.6 were used

Codex and GPT-5.6 were used across the full product loop:

1. **Research synthesis:** investigated joint attention, coordinated action, shared goals, mutual dependence, and synchronized outcomes as mechanisms for making online interaction feel gathered.
2. **Product decisions:** translated those findings into two distinct modes, a visible shared table, host participation, private Wish/Avoid input, one collective answer, and synchronized ticket delivery.
3. **Implementation:** built the Dining Plaza, instant-room APIs, QR/code joining, multi-device synchronization, restaurant proposal logic, anonymous objection flow, and final ticket state.
4. **Visual integration:** generated and refined the garden/table assets, then integrated them into responsive product screens while preserving the working interaction model.
5. **Verification:** exercised the room flow in a real browser and validated the branch with Vitest, TypeScript, ESLint, diff checks, and a production build.

Key design choices were made deliberately: instant groups get one tap-oriented Wish and one optional Avoid rather than another long questionnaire; objections stay anonymous so quieter participants can protect a real constraint; and the outcome is a shared ticket rather than four separate recommendation screens.

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
