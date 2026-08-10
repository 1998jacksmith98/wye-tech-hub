# Tech Hub (Web)

Web-based project hub for the Webb Yates Revit technician team.

## What you get

- Microsoft Entra login (plus local **dev login** for building without Azure)
- Projects, assignees, timeline, checklist, tagged information feed
- Weekly board for Monday syncs
- File uploads to **SharePoint** when Graph is configured (local `uploads/` fallback otherwise)
- Multi-tenant-ready schema (starts as one WYE organisation)

## Local setup

1. Use Node 20+ (this repo can use the portable Node under `../.tools/node` if needed).
2. From this `web` folder:

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)
4. On the login page, use **Continue locally** (dev mode is on by default).

## Environment

Copy `.env.example` to `.env`. Important keys:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite locally (`file:./dev.db`). Use Postgres in production. |
| `AUTH_SECRET` | Random secret for sessions |
| `AUTH_DEV_MODE` | `true` enables local name/email login |
| `AUTH_MICROSOFT_ENTRA_ID_*` | Entra app registration for real Microsoft login |
| `ALLOWED_EMAIL_DOMAINS` | Who can join on first Microsoft login |
| `SHAREPOINT_DRIVE_ID` | Document library drive for attachments |

## Microsoft / SharePoint (production)

1. Create an Entra ID app registration.
2. Add redirect URI: `https://YOUR_DOMAIN/api/auth/callback/microsoft-entra-id` (and localhost while testing).
3. Create a client secret.
4. Grant Graph delegated permissions: `User.Read`, `Files.ReadWrite.All`, `Sites.ReadWrite.All` (or tighter `Sites.Selected`).
5. Create a SharePoint site + document library for Tech Hub.
6. Put the drive id in `SHAREPOINT_DRIVE_ID`.
7. Set `AUTH_DEV_MODE=false` before real team use.

## Scripts

- `npm run dev` — local server
- `npm run build` / `npm start` — production
- `npm run db:push` — sync Prisma schema
- `npm run db:seed` — seed WYE organisation
