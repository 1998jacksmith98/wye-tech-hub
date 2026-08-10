"""
WYE Tech Hub - Reusable UI Components
"""

import customtkinter as ctk
from theme import COLORS, FONTS


def styled_frame(parent, **kwargs):
    defaults = dict(fg_color=COLORS["bg_mid"], corner_radius=8)
    defaults.update(kwargs)
    return ctk.CTkFrame(parent, **defaults)


def card_frame(parent, **kwargs):
    defaults = dict(fg_color=COLORS["bg_panel"], corner_radius=8,
                    border_width=1, border_color=COLORS["border"])
    defaults.update(kwargs)
    return ctk.CTkFrame(parent, **defaults)


def section_label(parent, text, **kwargs):
    defaults = dict(text=text, font=ctk.CTkFont(*FONTS["heading"]),
                    text_color=COLORS["text_secondary"])
    defaults.update(kwargs)
    return ctk.CTkLabel(parent, **defaults)


def title_label(parent, text, **kwargs):
    defaults = dict(text=text, font=ctk.CTkFont(*FONTS["title"]),
                    text_color=COLORS["text_primary"])
    defaults.update(kwargs)
    return ctk.CTkLabel(parent, **defaults)


def body_label(parent, text, **kwargs):
    defaults = dict(text=text, font=ctk.CTkFont(*FONTS["body"]),
                    text_color=COLORS["text_primary"])
    defaults.update(kwargs)
    return ctk.CTkLabel(parent, **defaults)


def muted_label(parent, text, **kwargs):
    defaults = dict(text=text, font=ctk.CTkFont(*FONTS["small"]),
                    text_color=COLORS["text_muted"])
    defaults.update(kwargs)
    return ctk.CTkLabel(parent, **defaults)


def primary_button(parent, text, command=None, **kwargs):
    defaults = dict(
        text=text, command=command,
        fg_color=COLORS["accent"], hover_color=COLORS["accent_light"],
        text_color=COLORS["text_primary"],
        font=ctk.CTkFont(*FONTS["body"]),
        corner_radius=6, height=34
    )
    defaults.update(kwargs)
    return ctk.CTkButton(parent, **defaults)


def ghost_button(parent, text, command=None, **kwargs):
    defaults = dict(
        text=text, command=command,
        fg_color="transparent", hover_color=COLORS["bg_hover"],
        text_color=COLORS["text_secondary"], border_color=COLORS["border"],
        border_width=1,
        font=ctk.CTkFont(*FONTS["body"]),
        corner_radius=6, height=32
    )
    defaults.update(kwargs)
    return ctk.CTkButton(parent, **defaults)


def danger_button(parent, text, command=None, **kwargs):
    defaults = dict(
        text=text, command=command,
        fg_color=COLORS["danger"], hover_color="#B84444",
        text_color=COLORS["text_primary"],
        font=ctk.CTkFont(*FONTS["small"]),
        corner_radius=6, height=28
    )
    defaults.update(kwargs)
    return ctk.CTkButton(parent, **defaults)


def styled_entry(parent, placeholder="", **kwargs):
    defaults = dict(
        placeholder_text=placeholder,
        fg_color=COLORS["bg_input"], border_color=COLORS["border"],
        text_color=COLORS["text_primary"],
        placeholder_text_color=COLORS["text_muted"],
        font=ctk.CTkFont(*FONTS["body"]),
        corner_radius=6, height=34
    )
    defaults.update(kwargs)
    return ctk.CTkEntry(parent, **defaults)


def styled_dropdown(parent, values, variable=None, command=None, **kwargs):
    """
    Uses CTkComboBox (readonly) instead of CTkOptionMenu to avoid a
    Python 3.13 / customtkinter 5.x crash with dropdown menus.
    API kept compatible: pass variable= or command= as before.
    """
    height = kwargs.pop("height", 34)
    width  = kwargs.pop("width", 0)

    combo_kwargs = dict(
        values=values,
        fg_color=COLORS["bg_input"],
        border_color=COLORS["border"],
        button_color=COLORS["accent_dim"],
        button_hover_color=COLORS["accent"],
        dropdown_fg_color=COLORS["bg_panel"],
        dropdown_hover_color=COLORS["bg_hover"],
        dropdown_text_color=COLORS["text_primary"],
        text_color=COLORS["text_primary"],
        font=ctk.CTkFont(*FONTS["body"]),
        corner_radius=6,
        height=height,
        state="readonly",
    )
    if width:
        combo_kwargs["width"] = width
    if variable is not None:
        combo_kwargs["variable"] = variable
    if command is not None:
        combo_kwargs["command"] = command
    combo_kwargs.update(kwargs)

    combo = ctk.CTkComboBox(parent, **combo_kwargs)
    return combo


def styled_textbox(parent, **kwargs):
    defaults = dict(
        fg_color=COLORS["bg_input"], border_color=COLORS["border"],
        text_color=COLORS["text_primary"],
        font=ctk.CTkFont(*FONTS["body"]),
        corner_radius=6
    )
    defaults.update(kwargs)
    return ctk.CTkTextbox(parent, **defaults)


def divider(parent, **kwargs):
    defaults = dict(fg_color=COLORS["border"], height=1)
    defaults.update(kwargs)
    return ctk.CTkFrame(parent, **defaults)


def status_badge(parent, status: str):
    """Returns a small coloured label badge for job status."""
    color = COLORS["success"] if status == "Active" else COLORS["text_muted"]
    bg = COLORS["accent_dim"] if status == "Active" else COLORS["bg_input"]
    return ctk.CTkLabel(
        parent, text=f"  {status}  ",
        font=ctk.CTkFont(*FONTS["tiny"]),
        text_color=color, fg_color=bg,
        corner_radius=4, width=60, height=20
    )


def tag_chip(parent, label: str, value: str, color: str = None):
    """Renders a small tag chip: 'SOURCE: Teams'"""
    c = color or COLORS["accent_dim"]
    frame = ctk.CTkFrame(parent, fg_color=c, corner_radius=4)
    lbl = ctk.CTkLabel(
        frame, text=f"{label}: {value}",
        font=ctk.CTkFont(*FONTS["tiny"]),
        text_color=COLORS["text_primary"],
        padx=6, pady=2
    )
    lbl.pack()
    return frame


class ScrollableCardList(ctk.CTkScrollableFrame):
    """A scrollable frame styled for card lists."""
    def __init__(self, parent, **kwargs):
        defaults = dict(
            fg_color=COLORS["bg_dark"],
            scrollbar_button_color=COLORS["border"],
            scrollbar_button_hover_color=COLORS["accent_dim"]
        )
        defaults.update(kwargs)
        super().__init__(parent, **defaults)
