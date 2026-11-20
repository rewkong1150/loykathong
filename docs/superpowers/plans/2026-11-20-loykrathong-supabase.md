# Loy Krathong Contest (Supabase rewrite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the contest site on Supabase. It has two contests (individual costume, team krathong), four working switches, admin-controlled result announcement, and the animated Royal Gold design.

**Architecture:**
- **Static React SPA.** All rules live in Postgres:
  - RLS policies
  - `security definer` RPCs
  - a signup trigger
- **Data access goes only through RPCs.** Clients never read the entry or vote tables directly. The only table they read is `settings`.
- **Realtime runs off one table, `settings`.** Its `data_version` counter is bumped by triggers whenever entries or votes change. Clients refetch when it changes. This keeps scores from leaking before results are announced.

**Tech Stack:**
- React 19, Vite 6, TypeScript 5.8
- `@supabase/supabase-js` v2
- Vitest
- `@electric-sql/pglite` (in-process Postgres, used to test the SQL)
- Plain CSS ported from the mockup (the spec allows Tailwind or plain CSS; we pick plain CSS so the mockup's CSS ports one to one)

**Spec:** `docs/superpowers/specs/2026-11-20-loykrathong-supabase-design.md`. The visual reference is `docs/superpowers/specs/2026-11-20-royal-gold-mockup.html`.

## Global Constraints

- **Company domain:** `villacartegroup.com`. All email comparisons are case-insensitive, done on `lower(email)`.
- **Admin:** exactly one, `patomporn.k@villacartegroup.com`.
- **Scoring:** score = `10 × votes + admin_adjustment`.
- **Votes:** 1 vote per user per contest. Votes are final.
- **Language:** all UI copy is in English. Toasts replace every `alert()`.
- **Config:** env vars are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. No secrets in the repo.
- **Removals:** delete all Firebase and Gemini/AI Studio code, config and the importmap.
- **Settings flags:** all start `false`.
  - `costume_registration_open`
  - `costume_voting_open`
  - `krathong_registration_open`
  - `krathong_voting_open`
  - `costume_results_published`
  - `krathong_results_published`
- **Animation:** must respect `prefers-reduced-motion`. Use transforms and opacity only, plus a canvas for confetti.
- **Commits:** none. The user hasn't asked for commits, so skip any commit step.

## Review Focus

1. **Peeking at scores before results.** A non-admin tries to see scores early, either through `get_leaderboard` or by reading `votes`, `costume_entries` or `krathong_teams` directly. Expected: scores come back null, and direct reads are denied. Tested in Task 2.
2. **The admin closes voting while the page is open.** A user still has the page open and the Vote button showing. Expected: `cast_vote` rejects with `VOTING_CLOSED`, and the UI shows a toast. Tested in Task 2 (the SQL side).
3. **Mixed-case emails.** For example `Patomporn.K@VillaCarteGroup.com`. Expected: treated as admin and as a company user, and matched against team member emails regardless of case. Tested in Tasks 2 and 3.
4. **Team membership conflicts.** A krathong member email that is already in another team, or an update that drops the creator. Expected: rejected with `MEMBER_IN_OTHER_TEAM` or `CREATOR_REQUIRED`. Tested in Task 2.
5. **Phone photos.** Large photos (10–20 MB) or HEIC files. Expected:
   - JPEG, PNG and WebP are resized to at most 1600px and re-encoded as JPEG.
   - HEIC and any other format are rejected with "Please upload a JPG, PNG or WebP photo".

   Tested in Task 3.

---

## File Structure

```
index.html                     minimal shell: fonts, #root
src/main.tsx                   React root
src/App.tsx                    wiring: auth state, settings and realtime, tabs, modals
src/styles/theme.css           tokens, base, buttons, toast (ported from mockup)
src/styles/scene.css           background animation CSS
src/styles/board.css           gallery, podium, rest list, reveal
src/lib/rules.ts               pure rules + constants (unit-tested)
src/lib/types.ts               shared types
src/lib/supabase.ts            client singleton
src/lib/api.ts                 typed wrappers over RPCs + storage upload
src/lib/image.ts               validate + compress image
src/lib/useLive.ts             hook: settings + realtime + refetch
src/components/Scene.tsx       animated background
src/components/Nav.tsx
src/components/Hero.tsx        headline + Programme status card
src/components/ContestTabs.tsx
src/components/Gallery.tsx     pre-results grid (no scores)
src/components/Podium.tsx      post-results podium + rest list (with reveal)
src/components/EntryFrame.tsx  gold frame with tilt/glare (shared)
src/components/EntryDetail.tsx modal body
src/components/CostumeForm.tsx
src/components/KrathongForm.tsx
src/components/AdminPanel.tsx
src/components/Modal.tsx
src/components/Toast.tsx       context + useToast()
src/components/Confetti.tsx    canvas + burst(x,y)
src/components/Gate.tsx        "Company accounts only" + sign-in screens
supabase/schema.sql            tables, RLS, RPCs, triggers, realtime
supabase/storage.sql           bucket + storage policies (run after schema.sql)
tests/db/auth-stub.sql         minimal Supabase auth/realtime stubs for PGlite
tests/db/db.test.ts            SQL behaviour tests
tests/unit/rules.test.ts
tests/unit/image.test.ts
```

Delete:
- `App.tsx`, `index.tsx`, `types.ts` and `constants.ts` at the repo root
- `config/` and `components/` at the repo root
- `metadata.json`

---

### Task 1: Scaffold and cleanup

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder), `.env.example`, `vitest.config.ts`
- Delete: the old files listed above

- [ ] **Step 1: Update dependencies.**
  - Remove `firebase` and `react-router-dom`.
  - Add `@supabase/supabase-js@^2`.
  - Add dev dependencies `vitest@^3`, `@electric-sql/pglite@^0.2` and `jsdom`.
  - Add the scripts `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`.
- [ ] **Step 2: Strip `vite.config.ts` and set up the environment.**
  - Strip `vite.config.ts` to just the React plugin and port 3000, with no `define`.
  - `.env.example` holds `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`.
  - Add `.env.local` to `.gitignore`.
- [ ] **Step 3: Rewrite `index.html` and add placeholders.**
  - `index.html` keeps the Google Fonts link (Cormorant Garamond and Plus Jakarta Sans), `<div id="root">` and `/src/main.tsx`.
  - Drop the importmap, the Tailwind CDN script and the inline scene.
  - Add a placeholder `App` that renders "Loy Krathong".
- [ ] **Step 4: Verify the scaffold.**
  - Run `npm install`, `npm run typecheck`, `npx vite build`.
  - Expected: all three succeed.

### Task 2: Database schema, rules and SQL tests

**Files:**
- Create: `supabase/schema.sql`, `supabase/storage.sql`, `tests/db/auth-stub.sql`, `tests/db/db.test.ts`

**Interfaces:**
- **Produces the tables:**
  - `settings`: one row, `id = 1`. Holds the 6 boolean flags from Global Constraints, plus `data_version bigint` and `updated_at`.
  - `costume_entries(id uuid pk, user_id uuid unique, email, display_name, title, image_path, admin_adjustment int default 0, created_at)`
  - `krathong_teams(id, name, krathong_image_path, team_image_path, created_by uuid, created_by_email, admin_adjustment, created_at)`
  - `krathong_team_members(team_id fk cascade, email unique, name)`
  - `votes(id, user_id, contest text check in ('costume','krathong'), entry_id uuid, created_at, unique(user_id, contest))`
- **Produces the RPCs.** All are `security definer` with `set search_path = public`. Errors are raised as `raise exception '<CODE>'`.
  - `get_leaderboard(p_contest text) returns table(id uuid, name text, subtitle text, image_path text, team_image_path text, members jsonb, is_mine boolean, score int, rank int)`
    - `score` and `rank` are null unless that contest's results are published or the caller is the admin.
    - Ordered by score desc when scores are visible, otherwise by `created_at`.
    - For costume, `name = display_name` and `subtitle = title`. For krathong, `subtitle = 'N members'`.
  - `get_my_votes() returns table(contest text, entry_id uuid)`
  - `cast_vote(p_contest text, p_entry_id uuid) returns void`. Errors: `NOT_COMPANY`, `VOTING_CLOSED`, `ALREADY_VOTED`, `OWN_ENTRY`, `NOT_FOUND`.
  - `save_costume_entry(p_title text, p_image_path text, p_display_name text) returns uuid`
    - Inserts or updates the caller's own entry.
    - Error: `REGISTRATION_CLOSED`.
  - `delete_my_costume_entry() returns void`. Error: `REGISTRATION_CLOSED`.
  - `save_krathong_team(p_team_id uuid, p_name text, p_members jsonb, p_krathong_image_path text, p_team_image_path text) returns uuid`
    - A null `p_team_id` means create. Otherwise it updates, and only the creator may update.
    - `p_members` is `[{name,email}]`. The caller is always included.
    - Errors: `REGISTRATION_CLOSED`, `NOT_COMPANY_MEMBER`, `MEMBER_IN_OTHER_TEAM`, `CREATOR_REQUIRED`, `NOT_OWNER`, `ALREADY_IN_TEAM`.
  - `delete_my_krathong_team(p_team_id uuid) returns void`
  - `admin_set_flag(p_flag text, p_value boolean) returns void`
    - `p_flag` must be one of the 6 flag names. This uses a whitelisted `case`, never dynamic SQL from input.
    - Error: `NOT_ADMIN`.
  - `admin_adjust_score(p_contest text, p_entry_id uuid, p_delta int) returns void`
  - `admin_delete_entry(p_contest text, p_entry_id uuid) returns void`. Cascades to votes.
  - `admin_stats() returns table(contest text, entries int, votes int)`
- **Produces the helpers:** `is_company_user()`, `is_admin()` and `current_email()`. Each one reads `lower(auth.jwt()->>'email')`.
- **Produces the trigger:** `before insert on auth.users` raises `NOT_COMPANY` for other domains.
- **Privileges:**
  - `authenticated` has `select` on `settings` only. The RLS policy is `is_company_user()`.
  - All other tables have RLS enabled, no policies, and `revoke all` from `anon` and `authenticated`.
  - Execute on the RPCs is granted to `authenticated` only.
- **Triggers on entries, members and votes** run `update settings set data_version = data_version + 1`.
- **Realtime:** `alter publication supabase_realtime add table settings`.
- **`storage.sql`:**
  - Creates a public bucket, `entries`.
  - Insert, update and delete on `storage.objects` are allowed when `bucket_id = 'entries'`, `(storage.foldername(name))[1] = auth.uid()::text` and `is_company_user()`.
  - This file isn't run in tests.

- [ ] **Step 1: Write `tests/db/auth-stub.sql`.**
  - Create the schema `auth` with an `auth.users(id uuid pk, email text)` table.
  - `auth.jwt()` returns `current_setting('request.jwt.claims', true)::jsonb`.
  - `auth.uid()` returns `(auth.jwt()->>'sub')::uuid`.
  - Create the roles `anon` and `authenticated`, and `create publication supabase_realtime`.
- [ ] **Step 2: Write `tests/db/db.test.ts` (failing).**
  - It boots PGlite and runs the stub plus `supabase/schema.sql`.
  - It defines a helper, `as(email, uid)`. The helper runs `set role authenticated; select set_config('request.jwt.claims', json_build_object('sub',uid,'email',email)::text, false)`.
  - A helper `asAdmin()` runs `set role postgres` and flips flags directly.
  - Tests (one `it` each):
    - `rejects non-company signup`: `insert into auth.users` with `x@gmail.com` throws `NOT_COMPANY`.
    - `non-company jwt cannot read settings`: `as('x@gmail.com')`, then select from settings, returns 0 rows.
    - `register blocked when closed`: `save_costume_entry` throws `REGISTRATION_CLOSED`.
    - `vote blocked when closed`: throws `VOTING_CLOSED`, then succeeds after the flag is opened.
    - `one vote per contest`: a second `cast_vote` in costume throws `ALREADY_VOTED`, but a krathong vote still works.
    - `cannot vote own costume entry` / `cannot vote own team (member email, mixed case)`: both throw `OWN_ENTRY`.
    - `scores hidden until published`:
      - As a normal user, `get_leaderboard('costume')` returns rows where every `score` is null.
      - As the admin (`Patomporn.K@VillaCarteGroup.com`), it returns non-null scores.
      - After `costume_results_published = true`, the normal user sees `score = 10` for an entry with 1 vote.
    - `no direct table reads`: as a normal user, `select * from votes` throws a permission error, and so does `select admin_adjustment from costume_entries`.
    - `member in other team rejected`: throws `MEMBER_IN_OTHER_TEAM`.
    - `update dropping creator rejected`: throws `CREATOR_REQUIRED`.
    - `non-admin cannot set flag`: throws `NOT_ADMIN`.
    - `admin_set_flag rejects unknown flag`.
    - `admin adjust adds to score`: `+5` gives `score = 15`.
    - `admin delete cascades votes`: after the delete, the voter can `cast_vote` again.
    - `data_version bumps on vote`.
- [ ] **Step 3: Confirm the tests fail.**
  - Run `npx vitest run tests/db`.
  - Expected: FAIL, because the schema file doesn't exist yet.
- [ ] **Step 4: Write the SQL.**
  - Write `supabase/schema.sql` and `supabase/storage.sql` to satisfy the interfaces above.
  - `schema.sql` must be idempotent enough to paste once into a fresh project. Use `create ... if not exists` where possible.
- [ ] **Step 5: Confirm the tests pass.**
  - Run `npx vitest run tests/db`.
  - Expected: all pass.

### Task 3: Pure rules, image handling, API layer

**Files:**
- Create: `src/lib/rules.ts`, `src/lib/types.ts`, `src/lib/image.ts`, `src/lib/supabase.ts`, `src/lib/api.ts`
- Test: `tests/unit/rules.test.ts`, `tests/unit/image.test.ts`

**Interfaces:**
- **`types.ts`:**
  - `type Contest = 'costume' | 'krathong'`
  - `interface Settings { costume_registration_open: boolean; costume_voting_open: boolean; krathong_registration_open: boolean; krathong_voting_open: boolean; costume_results_published: boolean; krathong_results_published: boolean; data_version: number }`
  - `interface Member { name: string; email: string }`
  - `interface Entry { id: string; name: string; subtitle: string; imageUrl: string; teamImageUrl: string | null; members: Member[]; isMine: boolean; score: number | null; rank: number | null }`
  - `type FlagKey = Exclude<keyof Settings, 'data_version'>`
- **`rules.ts`:**
  - Constants: `COMPANY_DOMAIN`, `ADMIN_EMAIL`, `VOTE_POINTS = 10`
  - `isCompanyEmail(e?: string | null): boolean`
  - `isAdminEmail(e?: string | null): boolean`
  - `stableShuffle<T extends { id: string }>(items: T[], seed: string): T[]`
  - `voteButton(p: { signedIn: boolean; votingOpen: boolean; isMine: boolean; votedId: string | null; entryId: string }): { label: string; enabled: boolean }`. The labels are exactly:
    - `'Sign in to vote'`
    - `'Voting closed'`
    - `'Your entry'`
    - `'✓ You voted'`
    - `'Already voted'`
    - `'✦ Cast your vote'`
  - `errorMessage(code: string): string`. Maps each RPC error code to friendly English text.
- **`image.ts`:**
  - `validateImageFile(f: { type: string; name: string }): string | null`. Returns null when the file is OK. Otherwise it returns exactly `'Please upload a JPG, PNG or WebP photo'`.
  - `compressImage(file: File, maxSide = 1600): Promise<Blob>`. Uses canvas and `createImageBitmap`, and outputs JPEG at quality 0.85.
- **`api.ts`:** one function per RPC from Task 2, all camelCase:
  - `getLeaderboard(c): Promise<Entry[]>`. Maps `image_path` to a public URL through `supabase.storage.from('entries').getPublicUrl`.
  - `getMyVotes(): Promise<Record<Contest, string | null>>`
  - `castVote(c, id)`
  - `saveCostumeEntry(title, imagePath, displayName)`
  - `deleteMyCostumeEntry()`
  - `saveKrathongTeam(teamId | null, name, members, kPath, tPath)`
  - `deleteMyKrathongTeam(id)`
  - `adminSetFlag(flag: FlagKey, v)`
  - `adminAdjustScore(c, id, delta)`
  - `adminDeleteEntry(c, id)`
  - `adminStats()`
  - `getSettings(): Promise<Settings>`
  - `uploadImage(file: File, userId: string, slot: string): Promise<string>`. Compresses the file, uploads it to `${userId}/${slot}-${Date.now()}.jpg` and returns the path.
  - `signInWithGoogle()`. Uses `signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'villacartegroup.com', prompt: 'select_account' }, redirectTo: location.origin } })`.
  - `signOut()`
  - On an RPC error, functions throw `new Error(code)`. The code comes from the Postgres error message.

- [ ] **Step 1: Write the unit tests (failing).**
  - `isCompanyEmail('A@VillaCarteGroup.com') === true`
  - `isCompanyEmail('a@villacartegroup.com.evil.io') === false`
  - `isAdminEmail('Patomporn.K@villacartegroup.com') === true`
  - `stableShuffle` returns the same order for the same seed and keeps every item.
  - `voteButton` returns each of the 6 labels for the matching input.
  - `validateImageFile({type:'image/heic',name:'a.heic'})` returns the error string.
  - `validateImageFile({type:'image/jpeg',name:'a.jpg'})` returns null.
- [ ] **Step 2: Confirm the tests fail.**
  - Run `npx vitest run tests/unit`.
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Implement `rules.ts`, `types.ts`, `image.ts`, `supabase.ts` and `api.ts`.
  - `supabase.ts` throws a clear error naming the missing env var.
- [ ] **Step 4: Verify.**
  - Run `npx vitest run` and `npm run typecheck`.
  - Expected: both pass.

### Task 4: Royal Gold visual system and animated scene

**Files:**
- Create: `src/styles/theme.css`, `src/styles/scene.css`, `src/styles/board.css`, `src/components/Scene.tsx`, `Nav.tsx`, `Hero.tsx`, `ContestTabs.tsx`, `EntryFrame.tsx`, `Toast.tsx`, `Confetti.tsx`, `Modal.tsx`

**Interfaces:**
- `<Scene />`
  - Takes no props.
  - Generates stars, lanterns, dust, reflection and krathongs once with `useMemo`, using the mockup's counts and timings.
  - On narrow screens (under 640px wide) it halves the counts.
- `<Nav user={{name, email, avatarUrl} | null} isAdmin onSignIn onSignOut />`
- `<Hero settings={Settings} onPrimary={() => void} primaryLabel={string} />`
  - The Programme card shows the status of each contest, derived from the flags:
    - "Results announced" if results are published;
    - otherwise "Voting open";
    - otherwise "Registration open";
    - otherwise "Closed".
- `<ContestTabs value={Contest} onChange />`. Has the sliding gold underline.
- `<EntryFrame imageUrl crown?={boolean} onClick>`. Has the 3D tilt and glare from the mockup.
- `useToast(): (html: string) => void`
- `useConfetti(): (x: number, y: number) => void`

- [ ] **Step 1: Port the mockup.**
  - Move the CSS from `docs/superpowers/specs/2026-11-20-royal-gold-mockup.html` into the 3 CSS files, keeping class names.
  - Port its scene, toast and confetti JS into the components above.
- [ ] **Step 2: Build a preview.**
  - Temporarily render `Scene`, `Nav` and `Hero` with fake settings in `App`.
  - Run `npx vite`, then open it in the browser pane.
  - Expected: the same motion as the mockup, with no console errors.
- [ ] **Step 3: Typecheck.**
  - Run `npm run typecheck`.
  - Expected: pass.

### Task 5: Boards, reveal, forms, admin, app wiring

**Files:**
- Create: `src/lib/useLive.ts`, `src/components/Gallery.tsx`, `Podium.tsx`, `EntryDetail.tsx`, `CostumeForm.tsx`, `KrathongForm.tsx`, `AdminPanel.tsx`, `Gate.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `useLive(userId)` returns `{ settings, boards: Record<Contest, Entry[]>, myVotes, refresh }`.
  - It subscribes to `postgres_changes` on `public.settings`.
  - Whenever `data_version` or a flag changes, it refetches the settings, both leaderboards and the user's votes.
  - It also refetches when the tab regains focus.
- `<Gallery entries contest settings myVotes signedIn onVote(entry, btnEl) onOpen(entry) />`
  - Shows the "Results coming soon" banner.
  - Orders entries with `stableShuffle(entries, userId)`.
  - Never shows a score.
- `<Podium entries reveal={boolean} />`
  - Places II, I and III in that order, followed by the rest list.
  - When `reveal` is true it plays the reveal sequence: III at 0s, II at 0.9s, I at 1.8s, then the crown drop, the count-up and a full-screen confetti burst.
- `App` uses `Podium` when results are published for the current tab or the user is the admin. Otherwise it uses `Gallery`.
  - `reveal` is true only when the published flag flips from false to true while the page is open, as observed through realtime.
  - The admin always sees the scores, and always has a "Preview reveal" button.
- `CostumeForm` / `KrathongForm`
  - Each opens in a `Modal`.
  - They use `validateImageFile`, `uploadImage` and then the save RPC.
  - The edit and delete actions only show while that contest's registration is open.
  - The krathong form adds members by name and company email. The creator's row is fixed.
- `AdminPanel` is only for `isAdminEmail`.
  - 6 toggles: 4 switches, plus Announce/Hide for each contest's results. Each one asks `confirm` through a modal.
  - Shows stats from `adminStats()`.
  - Each card gets +5, −5 and delete controls, passed through to the boards as an `admin` prop.
- `Gate`
  - Signed out: a sign-in hero.
  - Signed in with a non-company email: "Company accounts only", then an automatic `signOut`.

- [ ] **Step 1: Implement.**
  - Implement `useLive`, `Gallery`, `Podium` (with the reveal) and `EntryDetail`.
  - Wire them in `App` with tabs. The default tab is the contest with something open, costume first.
- [ ] **Step 2: Add the forms and admin panel.**
  - Implement `CostumeForm`, `KrathongForm`, `AdminPanel` and `Gate`.
  - Map every RPC error through `errorMessage` into a toast.
- [ ] **Step 3: Verify.**
  - Run `npm run typecheck`, `npx vitest run` and `npx vite build`.
  - Expected: all pass.
- [ ] **Step 4: Check the visuals.**
  - Use a temporary `?demo` fixture flag in `useLive` that returns fake data. Remove it afterwards.
  - Check the gallery, the reveal, the podium and the forms in the browser pane.
  - Expected: they match the mockup, with no console errors.

### Task 6: README and setup guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the README.** Replace the AI Studio README with:
  - creating the Supabase project;
  - creating the Google Cloud OAuth client, and its authorised redirect URI, `https://<project>.supabase.co/auth/v1/callback`;
  - enabling the Google provider in Supabase;
  - setting the Site URL and redirect URLs;
  - running `supabase/schema.sql` and then `supabase/storage.sql` in the SQL editor;
  - creating `.env.local`;
  - `npm run dev` / `npm run build`;
  - how the admin runs the day: open registration, open voting, close voting, announce results.
- [ ] **Step 2: Final verification.**
  - Run `npx vitest run`, `npm run typecheck` and `npx vite build`.
  - Expected: all pass.
