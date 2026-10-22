# The Humor Project: Admin

Admin area for [The Humor Project](https://github.com/EbebeLionel/HumorProject). It's a separate Next.js app that talks to the same Supabase database.

## What it does

| Area | Route | Access |
| --- | --- | --- |
| Stats dashboard | `/` | Daily activity, when campus is funniest, which vibe/theme/caption length lands, hall of fame/shame, most divisive captions, top creators, voter superlatives, model usage |
| Users / profiles | `/users`, `/users/[id]` | **Read**: search, sort, per-user photos and vote history |
| AI generated media | `/media`, `/media/new`, `/media/[id]` | **Create** (upload + Gemini or hand-written captions), **read**, **update** (vibe, theme, caption text, add captions), **delete** (single captions, or the whole photo including its storage file) |
| Upvotes / downvotes / ratings | `/votes` | **Read**: raw vote log (filter by vote or voter) and per-caption ratings (score, most votes, most divisive) |

## Security: the login wall

Every route except `/login` and `/auth/*` requires a Google sign-in **and** `profiles.is_superadmin = true`. It's enforced in three layers:

1. `src/proxy.ts` runs on every request and redirects anyone else to `/login`.
2. The `(admin)` layout and every server action call `requireAdmin()` / `adminOrNull()` again.
3. The database: the RLS policies in `supabase/migrations/20261021000000_superadmin.sql` only give the extra read/write access to superadmins. Even a bug in this app can't expose data to a non-admin.

Non-admins who sign in with Google are signed straight back out.

### "Won't I be locked out?"

Yes, at first. Nobody has `is_superadmin = true`, and the app can't grant it. A trigger stops anyone from setting the flag through the API, so users can't promote themselves. You get around this with the access you already have outside the app: the **Supabase dashboard SQL editor**. It runs as the database owner (`postgres`), which bypasses RLS and the trigger. Sign in to the main app once with Google so your profile exists, then run:

```sql
update public.profiles set is_superadmin = true where email = 'your-uni@columbia.edu';
```

That's the bootstrap step. Any later admins are promoted the same way.

## Setup

1. Run `supabase/migrations/20261021000000_superadmin.sql` in the Supabase SQL editor, then the `update` above.
2. Create `.env.local` (and add the same variables in Vercel):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   GEMINI_API_KEY=...        # only needed for "Generate with Gemini"
   ```
3. In Supabase → Authentication → URL Configuration, add `https://<admin-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) to the redirect URLs.
4. `npm install && npm run dev`
