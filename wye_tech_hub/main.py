"""
WYE Tech Hub - Main Application
Entry point: user selection → home → job detail
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox
import os

# Force dark mode
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

from theme import COLORS, FONTS, TEAM_MEMBERS
from components import (
    styled_frame, card_frame, section_label, title_label, body_label,
    muted_label, primary_button, ghost_button, divider, styled_dropdown
)
import database as db


class UserSelectScreen(ctk.CTkFrame):
    """First screen shown on launch - pick your name."""
    def __init__(self, parent, on_select):
        super().__init__(parent, fg_color=COLORS["bg_dark"])
        self.on_select = on_select
        self._build()

    def _build(self):
        # Centre everything
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        panel = ctk.CTkFrame(
            self, fg_color=COLORS["bg_mid"],
            corner_radius=16, border_width=1, border_color=COLORS["border"],
            width=400
        )
        panel.grid(row=0, column=0, padx=40, pady=40)
        panel.grid_propagate(False)

        # Logo
        ctk.CTkLabel(
            panel, text="WYE",
            font=ctk.CTkFont("Inter", 42, "bold"),
            text_color=COLORS["accent"]
        ).pack(pady=(48, 0))

        ctk.CTkLabel(
            panel, text="Tech Hub",
            font=ctk.CTkFont("Inter", 28, "bold"),
            text_color=COLORS["text_primary"]
        ).pack()

        ctk.CTkLabel(
            panel, text="Webb Yates Engineers",
            font=ctk.CTkFont(*FONTS["body"]),
            text_color=COLORS["text_muted"]
        ).pack(pady=(4, 40))

        divider(panel).pack(fill="x", padx=24)

        ctk.CTkLabel(
            panel, text="Who are you?",
            font=ctk.CTkFont(*FONTS["heading"]),
            text_color=COLORS["text_secondary"]
        ).pack(pady=(24, 8))

        self.user_var = ctk.StringVar(value=TEAM_MEMBERS[0])
        dd = styled_dropdown(panel, values=TEAM_MEMBERS, variable=self.user_var, width=280)
        dd.pack(pady=(0, 24))

        primary_button(
            panel, "Enter Tech Hub →",
            command=self._confirm,
            width=280, height=42,
            font=ctk.CTkFont("Inter", 14, "bold")
        ).pack(pady=(0, 48))

    def _confirm(self):
        self.on_select(self.user_var.get())


class NewJobDialog(ctk.CTkToplevel):
    def __init__(self, parent, user: str, on_save):
        super().__init__(parent)
        self.title("New Project")
        self.geometry("520x660")
        self.configure(fg_color=COLORS["bg_mid"])
        self.resizable(True, True)
        self.grab_set()
        self.user = user
        self.on_save = on_save
        self._build()

    def _build(self):
        from theme import ARCHITECT_SOFTWARES, REVIT_VERSIONS

        scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=COLORS["border"]
        )
        scroll.pack(fill="both", expand=True, padx=24, pady=20)
        scroll.grid_columnconfigure(0, weight=1)

        title_label(scroll, "New Project").grid(row=0, column=0, sticky="w", pady=(0, 16))

        def lbl(text, r):
            muted_label(scroll, text.upper()).grid(row=r, column=0, sticky="w", pady=(8, 2))

        def ent(r, ph="", default=""):
            from components import styled_entry
            e = styled_entry(scroll, placeholder=ph)
            e.grid(row=r, column=0, sticky="ew", pady=(0, 2))
            if default:
                e.insert(0, default)
            return e

        def dd(r, vals, default=None):
            from components import styled_dropdown
            d = styled_dropdown(scroll, values=vals)
            d.grid(row=r, column=0, sticky="ew", pady=(0, 2))
            if default and default in vals:
                d.set(default)
            return d

        lbl("Job Number", 1)
        self.e_num = ent(2, "e.g. WYE-2024-001")
        lbl("Job Name", 3)
        self.e_name = ent(4, "e.g. 30 Cannon Street")
        lbl("Lead Technician", 5)
        self.e_lead_tech = dd(6, TEAM_MEMBERS)
        lbl("Lead Engineer", 7)
        self.e_lead_eng = ent(8)
        lbl("Client", 9)
        self.e_client = ent(10)
        lbl("Architect", 11)
        self.e_arch = ent(12)
        lbl("Architect Software", 13)
        self.e_arch_sw = dd(14, ARCHITECT_SOFTWARES)
        lbl("Revit Version (WYE)", 15)
        self.e_revit = dd(16, REVIT_VERSIONS)
        lbl("Start Date (DD/MM/YYYY)", 17)
        self.e_start = ent(18)
        lbl("Next Issue Date (DD/MM/YYYY)", 19)
        self.e_next_issue = ent(20)

        primary_button(
            scroll, "Create Project →",
            command=self._save, height=40
        ).grid(row=21, column=0, sticky="ew", pady=(20, 0))

    def _save(self):
        num = self.e_num.get().strip()
        name = self.e_name.get().strip()
        if not num or not name:
            messagebox.showwarning("Required", "Job number and name are required.")
            return
        data = {
            "job_number": num,
            "job_name": name,
            "status": "Active",
            "lead_technician": self.e_lead_tech.get(),
            "lead_engineer": self.e_lead_eng.get().strip(),
            "client": self.e_client.get().strip(),
            "architect": self.e_arch.get().strip(),
            "architect_software": self.e_arch_sw.get(),
            "revit_version": self.e_revit.get(),
            "start_date": self.e_start.get().strip(),
            "next_issue_date": self.e_next_issue.get().strip(),
            "assigned_users": "[]",
        }
        job_id = db.create_job(data, self.user)
        self.on_save(job_id)
        self.destroy()


class WYETechHub(ctk.CTk):
    """Main application window."""
    def __init__(self):
        super().__init__()
        self.title("WYE Tech Hub")
        self.geometry("1280x820")
        self.minsize(960, 640)
        self.configure(fg_color=COLORS["bg_dark"])

        # Init DB
        db.init_database()

        self.current_user = None
        self.current_screen = None

        self._show_user_select()

    def _clear(self):
        for w in self.winfo_children():
            w.destroy()

    def _show_user_select(self):
        self._clear()
        screen = UserSelectScreen(self, on_select=self._on_user_selected)
        screen.pack(fill="both", expand=True)
        self.current_screen = screen

    def _on_user_selected(self, user: str):
        self.current_user = user
        self._show_home()

    def _show_home(self):
        self._clear()
        from screen_home import HomeScreen
        screen = HomeScreen(
            self,
            current_user=self.current_user,
            on_open_job=self._open_job,
            on_new_job=self._new_job,
            on_switch_user=self._show_user_select
        )
        screen.pack(fill="both", expand=True)
        self.current_screen = screen

    def _open_job(self, job_id: int):
        self._clear()
        from screen_job import JobScreen
        screen = JobScreen(
            self,
            job_id=job_id,
            current_user=self.current_user,
            on_back=self._show_home
        )
        screen.pack(fill="both", expand=True)
        self.current_screen = screen

    def _new_job(self):
        NewJobDialog(self, self.current_user, on_save=self._open_job)


if __name__ == "__main__":
    app = WYETechHub()
    app.mainloop()
