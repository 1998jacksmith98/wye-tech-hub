# WYE Tech Hub

Shared project notes hub for the Webb Yates Engineers technician team.

## Folders

| Path | What |
|---|---|
| [`web/`](web/) | **New web app** (Next.js) — use this |
| [`wye_tech_hub/`](wye_tech_hub/) | Original desktop CustomTkinter prototype |
| [`tools/latest-drawings/`](tools/latest-drawings/) | Latest issued PDF pack builder (Windows) |
| [`tools/revit/`](tools/revit/) | pyRevit Tech Hub tab (notes, checklist, board stage) |
| [`.tools/`](.tools/) | Optional portable Node for local development |

## Quick start (web)

```bash
cd web
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:3000 and use **Continue locally** on the login page.

Full setup notes (Microsoft login, SharePoint, deploy): see [`web/README.md`](web/README.md).
