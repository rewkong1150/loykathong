# Loy Krathong Contest — Supabase Rewrite (Design)

Date: 2026-11-20
Status: Draft, awaiting approval

## Intent

This rewrites the internal Loy Krathong contest site from scratch. The new version:

- moves from Firebase to **Supabase**;
- lets **only company accounts (@villacartegroup.com)** use the site;
- adds a **costume contest** next to the krathong contest;
- gives the admin **switches that really work**.

The admin opens and closes registration and voting by hand, on the day. In the old site the switches lived only in the admin's browser, so they changed nothing for anyone else. That is the main bug this rewrite fixes.

The UI stays in English. The look gets a modern, polished refresh, but the night-river theme (moon, stars, floating krathongs) stays.

## Goals

- **Two contests**, each with its own leaderboard:
  - **Costume** (morning): individual entries.
  - **Krathong** (afternoon): team entries.
- **Four switches**, each saved in the database and applied to every user right away:
  - Costume registration
  - Costume voting
  - Krathong registration
  - Krathong voting
- **Sign-in** with Google, company accounts only. The database enforces this as well as the UI.
- **One admin**: `patomporn.k@villacartegroup.com`. The database enforces this as well as the UI.
- **Voting rules**, enforced by the database:
  - Each user gets 1 vote per contest.
  - Users can't vote for their own costume entry or for a krathong team they belong to.
- **Live updates**: switch changes, new entries and score changes appear without a page reload.

## Non-goals

- Moving any data over from Firebase. The new event starts empty.
- Opening or closing anything automatically on a timer. The admin flips the switches by hand.
- Thai translation, multiple admins, or an admin-management UI.

## Anti-goals

These would count as failure even if everything else worked:

- A switch that looks off but still lets people register or vote, for example by calling the API directly.
- A non-company Google account getting in.
- Someone voting twice in the same contest.

## Constraints

- **Stack**: React 19 + Vite + TypeScript, same as today. Use `@supabase/supabase-js` v2.
- **Hosting**: static hosting, so there is no server code of our own. All rules live in Postgres (RLS policies, triggers and `security definer` functions).
- **Config**: the Supabase URL and anon key come from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Nothing secret goes in the repo, including the old hard-coded Firebase config.
- **Firebase removal**: drop all Firebase code and the AI Studio importmap and Gemini config.

## Approaches considered

1. **React + Vite + Supabase, with rules enforced in the database (chosen).** Keeps the current stack. Postgres RLS, triggers and RPC functions enforce the switches, the domain limit, the admin role and the voting rules. Because of that, they hold even if someone bypasses the UI.
2. **The same, but with checks only in the UI.** Faster to write, but it repeats the old bug: the switches and limits can be bypassed. Rejected.
3. **Next.js or our own backend.** More than this needs, and it would change how the site is hosted. Rejected.

## Data model (Supabase / Postgres)

### Tables

- `settings`: a single row (`id = 1`) with four flags, `costume_registration_open`, `costume_voting_open`, `krathong_registration_open` and `krathong_voting_open`, plus `updated_at`. All four start as `false`.
- `costume_entries`:
  - `id`
  - `user_id` (unique, so one entry per person)
  - `display_name`
  - `email`
  - `title` (an optional caption, e.g. "Lanna princess")
  - `image_path`
  - `admin_adjustment int default 0`
  - `created_at`
- `krathong_teams`: `id`, `name`, `krathong_image_path`, `team_image_path`, `created_by`, `admin_adjustment int default 0`, `created_at`.
- `krathong_team_members`:
  - `team_id`
  - `email` (company email, stored lowercase)
  - `name`
  - `email` is unique across the table, so a person can belong to only one krathong team.
- `votes`:
  - `id`
  - `user_id`
  - `contest` (`'costume' | 'krathong'`)
  - `entry_id`
  - `created_at`
  - `unique(user_id, contest)`

### Scores

A score is `10 × vote count + admin_adjustment`. A view or RPC returns each leaderboard with scores worked out. Ten points per vote matches the old site.

## Rules enforced in the database

- **Company domain**: an RLS helper `is_company_user()` checks that `auth.jwt()->>'email'` ends in `@villacartegroup.com`. Every policy requires it.
  - The Google sign-in also passes `hd=villacartegroup.com` so Google shows only company accounts.
  - A trigger on `auth.users` rejects other domains at signup.
- **Admin**: `is_admin()` checks that the JWT email is `patomporn.k@villacartegroup.com`. Only the admin can update `settings`, change `admin_adjustment` or delete entries.
- **Registration**:
  - Insert policies on `costume_entries` and `krathong_teams` require the matching `*_registration_open` flag.
  - The team and its members are created in one RPC, `register_krathong_team(name, members[], image paths)`, which also:
    - checks the flag;
    - checks that every member email is on the company domain;
    - checks that no member is already in another team;
    - always includes the creator as a member.
- **Voting**: users have no direct insert on `votes`. They can only vote through `cast_vote(contest, entry_id)`, which checks:
  - the voting flag for that contest;
  - that the user hasn't already voted in that contest (the unique constraint backs this up);
  - that it isn't their own costume entry or a team they belong to.
  - Votes are final, as in the old site.
- **Editing**: while registration for that contest is open, entrants can update their own entry (title, photo, team name) or delete it. Once registration closes, entries are locked except to the admin. *(Builder's call; the user didn't specify.)*
- **Reads**: all signed-in company users can read entries, scores and settings. Each user can read only their own rows in `votes`.

### Storage

There is one public-read bucket, `entries`. Signed-in company users can upload only under their own `user_id/` folder. Images are resized in the browser to at most about 1600px on the long side, then encoded as JPEG or WebP before upload.

### Realtime

The site subscribes to changes on `settings`, the entry tables and `votes`. When a change arrives, it refreshes the switches and leaderboards.

## UI

Single page, mobile-first.

### Header

- Logo/title, plus the signed-in user's avatar and name.
- Sign in / sign out.
- An "Admin" badge for the admin.

### Hero

- Event title and a short tagline.
- A **live status strip** with one pill for each contest phase, e.g. `Costume — Voting open` and `Krathong — Registration opens soon`. It updates in realtime.

### Contest tabs

- Two tabs, **Costume** and **Krathong**.
- The page opens on whichever contest currently has something open (costume first if both do).
- Each tab shows:
  - **Your status**: whether you've registered, your entry, and whether you've voted (and for whom).
  - A **primary action**: Register, or Edit entry, depending on the flag and whether you already have an entry.
  - A **leaderboard**: a podium for the top 3, then a card grid. Each card has the photo, name, score and a Vote button. The button says why when you can't vote: Voting closed / Your entry / Already voted.
  - A **detail modal**: a large photo, plus the members for a krathong team.

### Registration forms

- **Costume**: a photo, plus an optional title. The name and email are filled in automatically.
- **Krathong**: team name, krathong photo, team photo, and members added by name and company email. The creator is always included.

### Admin panel

Shown only to the admin, as a collapsible bar or drawer. It has:

- the 4 switches, each needing a confirm before it flips;
- an "Announce results" button for each contest;
- +/- score adjustment and delete on each card;
- quick stats: number of entries and votes per contest.

### Gate for outside accounts

If someone signs in with a non-company account, they see a clear "Company accounts only" screen and are signed out.

### Visual direction: "Royal Gold", animated (chosen by the user)

**The reference is [2026-11-20-royal-gold-mockup.html](2026-11-20-royal-gold-mockup.html).** The user picked it after seeing three static options and then this animated version. Match its look and motion closely.

The user said clearly that rich animation is essential, and that a static design is a failure.

- **Palette and type**:
  - Near-black ink (`#07060a`), with gold foil gradients (`#9c7a22 → #f7e3a1 → #c9982f`) and cream text.
  - Thin gold borders with corner brackets.
  - Cormorant Garamond for display and headings, Plus Jakarta Sans for UI text.
- **Living background** (fixed layer behind the content, always moving):
  - 12 krathongs floating across the river in both directions. Each one bobs, has a flickering candle flame and glow pool, and a reflection under it.
  - About 18 sky lanterns rising and swaying, with flickering light.
  - About 160 twinkling stars and occasional shooting stars.
  - A glowing, pulsing moon with a slowly rotating gold halo.
  - Drifting gold dust.
  - Layered moving waves and a shimmering moon reflection on the water.
  - A slowly drifting Thai-inspired gold pattern.
- **Content motion**:
  - The nav drops in.
  - Headline words rise in one by one with a moving gold-foil shimmer.
  - Buttons have a light-sweep shine.
  - Live status dots ping.
  - Cards rise onto the podium with a stagger, then tilt in 3D toward the cursor with a glare.
  - The winner's crown floats, and the winner's frame glows.
  - Scores count up.
  - The tab underline slides between tabs, and the board fades between contests.
- **Vote feedback**: a gold confetti and star burst from the button, plus a gold toast. The "+10" and the reordering in the mockup apply only after results are announced (and for the admin).
- **Before results**: a gallery of entry cards (same gold frames, tilt and glare) with no scores. A "Results coming soon" banner in gold sits above it.
- **After results**:
  - A podium for the top 3 (II, I, III, with the winner in the centre), plus compact cards for 4th place onward, as in the mockup.
  - It appears through the reveal animation described above.
- **Feedback**:
  - Toast notifications replace every `alert()`.
  - Every button has a clear disabled state with a reason.
- **Performance and accessibility**:
  - Use only CSS transforms and opacity, plus a small canvas for confetti.
  - Respect `prefers-reduced-motion`.
  - On narrow screens, reduce the number of background elements.
- **Tailwind**: installed properly (Tailwind v4 via `@tailwindcss/vite`), or use plain CSS modules. Port the mockup's CSS faithfully either way (builder's call).

## Deliverables

- The rewritten app source.
- `supabase/schema.sql`: one script to paste into the Supabase SQL editor. It creates the tables, policies, functions, triggers, bucket policies and the realtime publication.
- A README with:
  - creating the Supabase project;
  - enabling the Google provider (Google Cloud OAuth client and redirect URLs);
  - running `schema.sql`;
  - setting the env vars;
  - running and building the app.

## Decided by the user after review

- **Scores are hidden until the admin announces results.** This replaces an earlier "show live" answer.
  - `settings` gets two more flags: `costume_results_published` and `krathong_results_published`. Both start as `false`.
  - The admin panel gets an **"Announce results"** button for each contest. It asks for confirmation. A matching "Hide results" undo is available to the admin only.
  - The two contests are announced separately because they run at different times. *(Builder's call.)*
  - **Before announcing**:
    - Non-admins see entries in a stable shuffled order, with no scores, no ranks and no podium.
    - The vote button and the "you voted for X" status still work.
    - Vote feedback is confetti plus a toast. There is no "+10" and no reordering.
  - **The admin sees live scores at all times** in admin view.
  - **The rule is enforced in the database.** The leaderboard RPC returns scores and ranks only when that contest's results flag is true or the caller is the admin. Non-admins can't read `admin_adjustment` or other people's votes directly (column privileges or a view), so scores can't be worked out early.
  - **Announcing** is a realtime moment for everyone online. The page plays a reveal: III, then II, then I rise onto the podium one after another, scores count up, the winner's crown drops in, and gold confetti fills the screen. After the reveal, the podium and full ranking stay visible.
  - Realtime refreshes from `settings` and the entry tables, not from `votes` events.

## Calls made after review (builder's calls, user can override)

- **Admin delete is a hard delete.** Votes on that entry are deleted too (cascade), and those voters can vote again in that contest. Their pick was removed, so this is fair.
- **Krathong team owner = creator.** While krathong registration is open, the creator can edit the team name and photos, and add or remove members. This goes through an `update_krathong_team` RPC that re-checks the domain and the one-team-per-person rule. The creator always stays a member. Other members can only view.
- **Members don't need to have signed in yet.** They are free-text name + company email. The self-vote check matches the voter's email against member emails.
- **Status pills** show only Open / Closed for each phase, from the four flags. There are no "opens soon" or "ended" states and no extra schema.

## Left to the builder

- Component structure, state management (plain React hooks are enough) and file layout.
- Exact visual details within the direction above.
- Image compression approach.
- Whether to use a view or an RPC for leaderboards.

## Open items for the user

- The user creates the Supabase project and Google OAuth client, and supplies the URL and anon key. The builder can't do this for them.
