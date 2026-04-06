# MeshiMatch

MeshiMatch is a group restaurant recommendation app that helps friends, coworkers, and groups decide where to eat together. Instead of endless "where should we go?" conversations, MeshiMatch uses a tier-ranking survey system and AI-powered matching to find restaurants everyone will enjoy.

## How it works

1. **Create a group** — The organizer creates a group and shares an invite link
2. **Take the survey** — Participants can share departure area, preferred area, budget, genre preferences, dislikes, and restrictions. Partial participation is supported.
3. **Find candidate areas** — The system proposes top meeting areas using lightweight heuristics around accessibility, supply, and discovery value.
4. **Rank restaurants** — HotPepper API results are scored using group preference, budget fit, atmosphere, session focus, and restriction-aware rules.
5. **Pick a place** — Browse ranked results with reason tags and structured explanations, then decide on a restaurant.

## Tech stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + RLS), Next.js API routes
- **APIs**: HotPepper Gourmet Search API (restaurant data)
- **Libraries**: dnd-kit (drag-and-drop tier ranking), qrcode.react (profile sharing)

## Key features

- Priority-oriented genre preference UI with backward-compatible tier-based input
- Real-time group status tracking (who has responded)
- Candidate area recommendation plus restaurant ranking
- Invite links and QR code sharing
- Guest participation without account registration
- Session-level atmosphere and food/drink focus
- Allergy and dietary restriction awareness
- Logic-based reason tags and one-line explanations
