"""
WYE Tech Hub - Theme & Constants
"""

TEAM_MEMBERS = [
    "Jack", "Matt", "Jamy", "Nick", "Maria",
    "Leo", "Aileen", "Aliah", "Pascasio", "Brandon"
]

ARCHITECT_SOFTWARES = ["Revit", "Rhino", "AutoCAD", "ArchiCAD", "SketchUp", "Other"]

REVIT_VERSIONS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026", "N/A"]

TIMELINE_STAGES = ["Start", "S3 Issue", "S4 Issue", "S5 Issue", "Complete"]

# Tag definitions
TAG_SOURCES = ["Teams", "Email", "Call", "Meeting", "Revit", "PDF", "Screenshot", "Other"]
TAG_TOPICS = ["Slab", "Grid", "Columns", "Foundation", "Levels", "Coordination",
              "Admin", "Cladding", "Stairs", "Roof", "MEP Coordination", "Other"]
TAG_STATUS = ["Action Required", "FYI", "Resolved", "Pending"]
CONTENT_TYPES = ["Note", "Screenshot", "PDF", "Email (.msg)", "Teams Message", "Call Note", "File"]

# ── Colour Palette ─────────────────────────────────────────────────────────────
# Dark engineering-grade UI. WYE brand feel — structural, precise, professional.

COLORS = {
    # Backgrounds
    "bg_dark":      "#0F1117",   # near-black base
    "bg_mid":       "#171B26",   # card / panel background
    "bg_panel":     "#1E2333",   # slightly lighter panel
    "bg_input":     "#252A3A",   # input fields
    "bg_hover":     "#2A3045",   # hover state

    # WYE Brand accent — deep steel blue with a warm tint
    "accent":       "#4A7FA5",   # primary accent
    "accent_light": "#6BA3C8",   # hover / lighter variant
    "accent_dim":   "#2B4D63",   # subtle accent for tags/borders

    # Status colours
    "success":      "#3DAA74",   # green — complete / confirmed
    "warning":      "#E8A838",   # amber — pending / target date
    "danger":       "#D95F5F",   # red — overdue / action required
    "info":         "#6BA3C8",   # blue — FYI

    # Text
    "text_primary":   "#E8EAF0",
    "text_secondary": "#8C92A4",
    "text_muted":     "#555E74",
    "text_accent":    "#6BA3C8",

    # Borders
    "border":       "#2A3045",
    "border_light": "#353D55",

    # Stage colours
    "stage_s3":     "#7B61FF",
    "stage_s4":     "#4A7FA5",
    "stage_s5":     "#3DAA74",
    "stage_done":   "#3DAA74",
}

# Font sizes
FONTS = {
    "display": ("Inter", 28, "bold"),
    "title":   ("Inter", 18, "bold"),
    "heading": ("Inter", 14, "bold"),
    "body":    ("Inter", 12),
    "small":   ("Inter", 11),
    "tiny":    ("Inter", 10),
    "mono":    ("Courier New", 11),
}

def stage_color(stage: str) -> str:
    mapping = {
        "S3 Issue": COLORS["stage_s3"],
        "S4 Issue": COLORS["stage_s4"],
        "S5 Issue": COLORS["stage_s5"],
        "Complete": COLORS["stage_done"],
        "Start":    COLORS["accent"],
    }
    return mapping.get(stage, COLORS["accent"])
