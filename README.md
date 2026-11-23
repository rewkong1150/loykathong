# Loy Krathong Contest 2026 · Villa Carte

The internal contest site for Loy Krathong day:

- **Costume contest (morning).** Individual entries.
- **Krathong contest (afternoon).** Team entries.
- **Sign-in.** Only `@villacartegroup.com` and `@lagreenhotel.com` Google accounts can use the site.
- **Admin.** One admin, `patomporn.k@villacartegroup.com`, controls everything live:
  - opening and closing registration and voting for each contest;
  - announcing results, with a reveal animation that plays for everyone online.

**Stack:**
- React 19, Vite and TypeScript.
- Supabase for Postgres, auth, storage and realtime.
- Every rule is enforced in the database (`supabase/schema.sql`), so it holds even if someone bypasses the UI.

---

## 1. Supabase project

1. Create a project at https://supabase.com. This one is called `loykrathong` and is in Singapore.
2. **SQL Editor → New query.** Paste all of [`supabase/schema.sql`](supabase/schema.sql), then **Run**.
3. Open a new query, paste [`supabase/storage.sql`](supabase/storage.sql), then **Run**. This creates the `entries` photo bucket.
4. **Project Settings → API Keys.** Copy the **Project URL** and the **anon / publishable** key.

## 2. Google sign-in

1. Open [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services → Credentials**, and choose **Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorised JavaScript origins: your site URL (and `http://localhost:3000` for development).
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - If the OAuth consent screen asks, set the user type to **Internal**. That way only Villa Carte Google Workspace accounts can sign in.
2. In Supabase, go to **Authentication → Sign In / Providers → Google**. Turn it on, then paste the Client ID and Client Secret.
3. Go to **Authentication → URL Configuration**:
   - **Site URL:** your production URL.
   - **Redirect URLs:** add your production URL and `http://localhost:3000`.

The site asks Google for Workspace accounts only (`hd=*`, so no personal Gmail). The database rejects any domain other than the two company domains at sign-up.

## 3. Run it

```bash
cp .env.example .env.local
# Edit .env.local with your values:
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon / publishable key>
npm install
npm run dev
```

The site opens at http://localhost:3000.

**Preview without Supabase:** in development only, open `http://localhost:3000/?demo` to see a voter's view, or `/?demo=admin` for the admin's view. Both use fake in-memory data, and this demo mode is not included in production builds.

**Tests:**
- `npm test` runs the database rule tests (Postgres in-process via PGlite) and the unit tests.
- `npm run build` typechecks the code and builds the site into `dist/`.

## 4. Running the day (admin)

The **Admin controls** panel is visible only when you're signed in as the admin. Every switch asks for confirmation first, then applies to everyone straight away.

| When | Do this |
|---|---|
| Before the event | Open **Costume → Registration** (and Krathong registration whenever you like) |
| Morning | Open **Costume → Voting**. Close Costume registration if you want entries locked |
| End of costume voting | Close **Costume → Voting**, then press **✦ Announce results**. Everyone online sees the reveal |
| Afternoon | Same steps for **Krathong** |

- **Before results are announced:** nobody but you can see scores. They see entries in a random order and "Results coming soon".
- **Preview the reveal:** this replays the animation on your screen only.
- **Each card has −5 / +5 / Delete controls.** Deleting an entry also removes its votes, and those voters can vote again.
- **Hide results:** puts the scores back into hiding if you announced by mistake.

## Rules enforced by the database

- Only `@villacartegroup.com` and `@lagreenhotel.com` accounts can sign up, read data or call any function.
- Registration and voting only work while the matching switch is open.
- Each person gets 1 vote per contest. Votes are final. Nobody can vote for their own costume or a krathong team they're in.
- One costume entry per person. Each person can be in one krathong team, and only the team's creator can edit it. Entries can be edited only while registration is open.
- Scores and ranks are returned only after results are announced (the admin always sees them).
- Photos are resized in the browser (max 1600px, JPEG) and stored under each user's own folder.
