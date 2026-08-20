# Tech Hub for Revit (first draft)

A pyRevit tab so technicians can update Tech Hub without leaving the model.

## What you get

| Button | Does |
|---|---|
| **This Job** | Job name, board column, next issue, open checklist count |
| **New Note** | Same fields as the web information form + click-and-drag screenshot |
| **Checklist** | Tick / add items |
| **Move Stage** | Pipeline / Not started / Assigned / Checking / Complete |
| **Open Hub** | Opens the job tile in the browser |
| **Settings** | Hub URL + personal token |

Job number is read from the Revit **Project Number** parameter, then from the file name (`J4856 …`).

## Setup

1. Install [pyRevit](https://github.com/pyrevitlabs/pyRevit) if you do not already have it.
2. In pyRevit Settings → **Add folder as extension**, pick:

   `tools/revit`

   (the folder that contains `WyeTechHub.extension`).
3. Reload pyRevit. You should see a **WYE** tab with **Tech Hub**.
4. In the Tech Hub website, open **Revit** in the top nav, create a token, copy it once.
5. In Revit: **Settings** → paste the website URL (e.g. `http://localhost:3000` or the live URL) and the token → Save.

The token is stored only on that PC at `%APPDATA%\WyeTechHub\revit.json`. Revoke it from the website if a laptop is lost.

## Notes

- Anyone on the team can move the weekly-board stage.
- Screenshot hides the form, then you click-drag a region. Esc cancels.
- Combined with the existing web app — it does not replace the hub, it feeds it.
