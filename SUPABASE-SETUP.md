# Supabase setup — Omkar Control Center

The dashboard files are prepared for the existing GitHub Pages site. The upload system becomes live only after you connect your own Supabase project and run the SQL below.

## 1. Create your Supabase project
1. Open https://supabase.com/dashboard and create a new project.
2. Save the database password somewhere private.
3. Wait until the project is ready.

## 2. Create your single admin login
1. Open **Authentication → Users**.
2. Add one user using your own email address and a strong password.
3. Copy that user's **UID**.
4. Open **Authentication → Settings** and disable new user sign-ups / public sign-ups. Keep email + password sign-in enabled.
5. Do not create any other user accounts for this dashboard.

## 3. Apply the database and storage security
1. Open **SQL Editor → New query**.
2. Open `supabase-setup.sql` in this repository.
3. Replace `REPLACE-WITH-YOUR-AUTH-USER-UUID` with the UID copied in step 2.
4. Run the complete SQL script.
5. Confirm it finishes without errors.

The SQL allow-lists that one user UUID. Database writes and uploads are restricted to that account by Row Level Security. Public visitors can only read published portfolio entries. The asset bucket is public by design because published certificates and project images must be viewable without login.

## 4. Connect the browser client
1. In Supabase, open **Project Settings → API** (or **Connect**).
2. Copy the Project URL.
3. Copy the **publishable key** (or legacy `anon` key).
4. Edit `supabase-config.js` in this repository and paste those two values into `url` and `anonKey`.
5. Commit the file to GitHub.

**Never paste a `service_role` or secret key into this repository.** The browser key is intended to be public; the RLS policies are what protect the data.

## 5. Use the dashboard
Open https://omkar20056.github.io/Omkar-portfolio/admin.html and sign in with the one admin email/password.

- Choose Project or Certificate.
- Fill in the title and description.
- For projects, add optional screenshot, technologies, GitHub URL and live demo.
- For certificates, upload the certificate PDF or image.
- Press **Publish to portfolio**. It is published immediately; no separate approval step.
- Use Edit or Delete in the published entries list to manage it.

New entries appear in the Projects or Certificates section when the public portfolio is refreshed. Existing hand-written entries remain in place.

## Privacy
The `portfolio-assets` bucket is public. Upload only files you intend to show to every visitor. Do not upload IDs, transcripts with private data, addresses, signatures, or any document you want to keep private. A public bucket's file URLs can be opened by anyone who has the URL.

## Files added
- `admin.html` — login and private upload dashboard
- `admin.css` — dashboard styling
- `admin.js` — login, upload, edit, delete and auto-publish logic
- `supabase-config.js` — public project URL and publishable key placeholders
- `supabase-setup.sql` — database, allow-list, RLS and Storage policies
