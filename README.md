# Collectr

Collectr is a private home for mixed collectible collections. Its first release brings the catalog, named collections, and physical shelf positions together in one responsive workspace.

## Run the preview

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Without Supabase credentials, the app opens in **Local demo** mode. Items, collections, cabinets, and resized photos are stored in this browser's local storage; this is a local preview, not an account. Use Settings → Collection privacy to see the setup note.

## Enable private accounts

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/20261028010000_initial_collections.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI.
3. In Supabase Auth, enable email and password sign-in, set the app's site URL, and add `http://127.0.0.1:3000/auth/callback` and `http://127.0.0.1:3000/auth/reset-password` as allowed redirect URLs. Use the production domain in deployment settings.
4. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable/anon key, and site URL. Restart the dev server.
5. Add the same three environment variables to the private Vercel project settings before deploying.

The migration creates the owner-scoped database tables, row-level policies, private image bucket, profile bootstrap trigger, and atomic shelf move/resize functions. Photos accept JPEG, PNG, and WebP with a 10 MB original limit and temporary signed display URLs. Item queries load 50 at a time.

## Product and design context

- `PRODUCT.md` records the approved product truth and unresolved name.
- `DESIGN.md` contains the five-color palette and design rules.
- `.impeccable/surfaces/library.md` records the approved screen intent.
- `.impeccable/mocks/` retains the approved desktop and responsive design references.

“Collectr” is a working name. Choose and clear a distinct public name before launch. The sample names and item photographs are synthetic; there is no external product database, public profile, marketplace, or pricing integration.

## Commands

```bash
npm run dev
npm run build
npm test
```
