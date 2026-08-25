# -*- coding: utf-8 -*-
"""
Shared visual theme for Tech Hub Revit dialogs.
Colors/font pulled directly from the Tech Hub web app's CSS so the
Revit-side popups feel like the same product rather than a bare
Windows dialog.

Drop this file alongside api.py / config.py / job.py / run.py / ui.py
in the wyetechhub lib folder.
"""
import clr
clr.AddReference("System.Drawing")
clr.AddReference("System.Windows.Forms")
from System.Drawing import Color, Font, FontStyle, Rectangle, Size
from System.Windows.Forms import DrawItemState, DrawMode, FlatStyle, TextFormatFlags, TextRenderer

# Web app uses "Source Sans 3" with a Segoe UI fallback. Most Windows
# machines won't have Source Sans 3 installed — System.Drawing.Font
# silently substitutes the nearest match rather than throwing, so this
# is safe even where the font isn't present.
FONT_FAMILY = "Source Sans 3"
FONT_FALLBACK = "Segoe UI"

BG = Color.FromArgb(0xEE, 0xF2, 0xF5)           # --bg
BG_ELEVATED = Color.FromArgb(0xF8, 0xFA, 0xFC)  # --bg-elevated
ACCENT = Color.FromArgb(0x1F, 0x6F, 0x8B)       # --accent
ACCENT_HOVER = Color.FromArgb(0x18, 0x59, 0x70)  # darker accent for hover
TEXT = Color.FromArgb(0x10, 0x20, 0x33)         # body text
MUTED = Color.FromArgb(0x64, 0x74, 0x87)        # secondary text
LINE = Color.FromArgb(0xCF, 0xD8, 0xE2)         # --line (borders)
SUCCESS = Color.FromArgb(0x2F, 0x7D, 0x57)      # --success
WHITE = Color.FromArgb(0xFF, 0xFF, 0xFF)


def font(size=9, bold=False):
    style = FontStyle.Bold if bold else FontStyle.Regular
    try:
        return Font(FONT_FAMILY, size, style)
    except Exception:
        return Font(FONT_FALLBACK, size, style)


def style_form(form):
    form.BackColor = BG
    form.Font = font(9)
    form.ForeColor = TEXT


def style_label(label, bold=False, muted=False):
    label.Font = font(9, bold=bold)
    label.ForeColor = MUTED if muted else TEXT
    label.BackColor = Color.Transparent


def style_textbox(box):
    box.Font = font(9)
    box.ForeColor = TEXT
    box.BackColor = WHITE


def style_combo(combo):
    combo.Font = font(9)
    combo.ForeColor = TEXT
    combo.BackColor = WHITE


def style_listbox(listbox):
    listbox.Font = font(9)
    listbox.ForeColor = TEXT
    listbox.BackColor = WHITE


_WRAP_FLAGS = TextFormatFlags.WordBreak | TextFormatFlags.Left | TextFormatFlags.NoPrefix


def enable_word_wrap(listbox, padding=6):
    """
    Plain WinForms ListBoxes only ever draw one line per item, so long
    entries get truncated (or need a horizontal scrollbar). This switches
    the listbox to owner-draw mode: we measure how tall each item's
    wrapped text needs to be, then draw it ourselves. Call this once,
    any time after creating the listbox — before or after populating
    .Items, and it keeps working as items are added/removed later.
    """
    listbox.DrawMode = DrawMode.OwnerDrawVariable
    listbox.HorizontalScrollbar = False

    def _measure(sender, e):
        if e.Index < 0 or e.Index >= sender.Items.Count:
            e.ItemHeight = sender.Font.Height + padding
            return
        text = str(sender.Items[e.Index])
        width = max(sender.ClientSize.Width - padding * 2, 40)
        size = TextRenderer.MeasureText(text, sender.Font, Size(width, 0), _WRAP_FLAGS)
        e.ItemHeight = max(sender.Font.Height + padding, size.Height + padding)

    def _draw(sender, e):
        if e.Index < 0 or e.Index >= sender.Items.Count:
            return
        text = str(sender.Items[e.Index])
        e.DrawBackground()
        selected = bool(e.State & DrawItemState.Selected)
        color = WHITE if selected else TEXT
        rect = Rectangle(
            e.Bounds.X + padding, e.Bounds.Y + padding // 2,
            e.Bounds.Width - padding * 2, e.Bounds.Height - padding,
        )
        TextRenderer.DrawText(e.Graphics, text, sender.Font, rect, color, _WRAP_FLAGS)
        e.DrawFocusRectangle()

    listbox.MeasureItem += _measure
    listbox.DrawItem += _draw


def _flatten(button):
    button.FlatStyle = FlatStyle.Flat
    button.FlatAppearance.BorderSize = 1
    button.UseVisualStyleBackColor = False


def style_button_primary(button):
    """Main / confirming action — solid accent fill."""
    _flatten(button)
    button.BackColor = ACCENT
    button.ForeColor = WHITE
    button.Font = font(9, bold=True)
    button.FlatAppearance.BorderColor = ACCENT
    button.FlatAppearance.MouseOverBackColor = ACCENT_HOVER
    button.FlatAppearance.MouseDownBackColor = ACCENT_HOVER


def style_button_secondary(button):
    """Cancel / close / less prominent actions — outlined, white fill."""
    _flatten(button)
    button.BackColor = WHITE
    button.ForeColor = TEXT
    button.Font = font(9)
    button.FlatAppearance.BorderColor = LINE
    button.FlatAppearance.MouseOverBackColor = BG
    button.FlatAppearance.MouseDownBackColor = BG
