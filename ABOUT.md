# MeshiMatch

MeshiMatch is a group restaurant recommendation app that helps friends, coworkers, and groups decide where to eat together. Instead of endless "where should we go?" conversations, MeshiMatch uses a tier-ranking survey system and AI-powered matching to find restaurants everyone will enjoy.

## How it works

1. **Create a group** — The organizer creates a group and shares an invite link
2. **Take the survey** — Each member ranks food genres (Japanese, Italian, BBQ, etc.) into tiers: S (love it), A (like it), B (fine with it)
3. **AI matching** — The matching engine combines everyone's preferences, searches the HotPepper API for real restaurants, and scores each result
4. **Pick a place** — Browse ranked results sorted by match score or rating, view details, and decide on a restaurant

## Tech stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + RLS), Next.js API routes
- **APIs**: HotPepper Gourmet Search API (restaurant data)
- **Libraries**: dnd-kit (drag-and-drop tier ranking), qrcode.react (profile sharing)

## Key features

- Tier-based genre ranking with drag-and-drop UI
- Real-time group status tracking (who has responded)
- Restaurant search with match scores based on group consensus
- Invite links and QR code sharing
- Guest participation without account registration
- Area-based filtering (Shibuya, Shinjuku, Roppongi, etc.)
- Allergy and dietary restriction awareness
