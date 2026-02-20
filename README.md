# Attendance QR (No student login)

This is a simple responsive web app:
- Admin login (username + PIN; stored as Supabase Auth email/password internally)
- Create classes
- Add students (manual or CSV upload)
- Update/delete classes and students
- Delete and edit attendance types (points + time windows)
- Sample CSV available in the app
- Each student gets a unique QR code (stored in student profile; share + download)
- Create class events (date/time)
- QR scan check-in using mobile camera (attendance type decided from configurable time windows)
- Attendance summary table per event
- Reports: points summary per student + attendance details (both filterable by date range), sort points asc/desc, export PDF/Excel/CSV

## 1) Create Supabase project (free)
1. Create a Supabase project.
2. Go to **SQL Editor** → **New Query**
3. Paste and run: `supabase/schema.sql`

## 2) Get Supabase keys
In Supabase: **Project Settings → API**
- `Project URL`  -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon public key` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3) Deploy on Vercel (free)
You need a GitHub account.

### Option A (recommended): upload this folder to GitHub
1. Create a new GitHub repo (public or private).
2. Upload all files from this project folder.
3. In Vercel: **New Project** → Import that repo.

### Set environment variables in Vercel
In Vercel project settings → **Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then click **Deploy**.
Vercel will give you a URL like: `https://your-project.vercel.app`

## 4) Run locally (optional)
```bash
npm install
npm run dev
```

## Notes
- For best QR scanning: Chrome on Android, Safari on iOS.
- “Absent” is implied when no attendance record exists for a student in an event.
- You can adjust “late after minutes” per event.
