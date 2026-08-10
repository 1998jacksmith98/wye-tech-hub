# WYE Tech Hub — Setup Guide

A shared project information tool for the Webb Yates Engineers Revit technician team.

---

## Requirements

- Python 3.10 or later (download from python.org)
- Windows 10/11

## First-Time Setup (one person does this)

1. Copy the `wye_tech_hub` folder to your **shared network drive**, e.g.:
   ```
   Z:\WYE_Tech_Hub\
   ```

2. Open a terminal and run:
   ```
   pip install customtkinter Pillow
   ```

3. The database (`wye_tech_hub.db`) and attachments folder will be created
   automatically inside the folder when first launched.

---

## Running the App

### Option A — Double-click launcher (Windows)
Create a shortcut to `launch.bat` on everyone's desktop.

### Option B — Command line
```
python main.py
```

### Option C — Set a custom DB path (if the app and DB are in different locations)
Set the environment variable before launching:
```
set WYE_DB_PATH=Z:\WYE_Tech_Hub\data\wye_tech_hub.db
python main.py
```

---

## Shared Network Drive Setup

All team members should:
1. Have the network drive mapped to the same letter (e.g. `Z:`)
2. Run `main.py` from that shared folder — OR —
3. Set `WYE_DB_PATH` to point at the shared database file

The database uses WAL (Write-Ahead Logging) mode which handles multiple
simultaneous users gracefully on a shared drive.

---

## File Attachments

When you attach a file (screenshot, PDF, etc.) it is **copied** into the
`attachments/` folder next to the database on the shared drive.
This means everyone can open attachments from any machine.

---

## Folder Structure

```
wye_tech_hub/
├── main.py              ← Run this
├── database.py          ← DB logic
├── screen_home.py       ← Home screen
├── screen_job.py        ← Job detail screen
├── components.py        ← UI components
├── theme.py             ← Colours, fonts, constants
├── requirements.txt
├── README.md
└── data/
    ├── wye_tech_hub.db  ← SQLite database (shared)
    └── attachments/     ← Uploaded files (shared)
```

---

## Adding New Team Members

Open `theme.py` and add the name to the `TEAM_MEMBERS` list.
