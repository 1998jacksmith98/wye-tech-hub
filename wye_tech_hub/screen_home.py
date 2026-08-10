"""
WYE Tech Hub - Home Screen
Job list (left) + Activity Feed (right)
"""

import customtkinter as ctk
from datetime import datetime
from theme import COLORS, FONTS, TIMELINE_STAGES
from components import (
    styled_frame, card_frame, section_label, title_label, body_label,
    muted_label, primary_button, ghost_button, divider, status_badge,
    ScrollableCardList
)
import database as db


def format_time_ago(dt_str: str) -> str:
    if not dt_str:
        return ""
    try:
        dt = datetime.fromisoformat(dt_str)
        diff = datetime.now() - dt
        s = int(diff.total_seconds())
        if s < 60: return "just now"
        if s < 3600: return f"{s//60}m ago"
        if s < 86400: return f"{s//3600}h ago"
        return f"{diff.days}d ago"
    except Exception:
        return ""


class HomeScreen(ctk.CTkFrame):
    def __init__(self, parent, current_user: str, on_open_job, on_new_job, on_switch_user):
        super().__init__(parent, fg_color=COLORS["bg_dark"])
        self.current_user = current_user
        self.on_open_job = on_open_job
        self.on_new_job = on_new_job
        self.on_switch_user = on_switch_user
        self.status_filter = "Active"
        self._build()
        self.refresh()

    def _build(self):
        # ── Top bar ──────────────────────────────────────────────────────────
        topbar = styled_frame(self, fg_color=COLORS["bg_mid"], corner_radius=0)
        topbar.pack(fill="x", side="top")
        topbar.grid_columnconfigure(1, weight=1)

        # WYE logo area
        logo_frame = ctk.CTkFrame(topbar, fg_color="transparent")
        logo_frame.grid(row=0, column=0, padx=20, pady=12, sticky="w")

        ctk.CTkLabel(
            logo_frame, text="WYE",
            font=ctk.CTkFont("Inter", 22, "bold"),
            text_color=COLORS["accent"]
        ).pack(side="left")
        ctk.CTkLabel(
            logo_frame, text=" Tech Hub",
            font=ctk.CTkFont("Inter", 22, "bold"),
            text_color=COLORS["text_primary"]
        ).pack(side="left")

        # User info + switch
        user_frame = ctk.CTkFrame(topbar, fg_color="transparent")
        user_frame.grid(row=0, column=2, padx=20, pady=12, sticky="e")

        ctk.CTkLabel(
            user_frame, text=f"👤  {self.current_user}",
            font=ctk.CTkFont(*FONTS["body"]),
            text_color=COLORS["text_secondary"]
        ).pack(side="left", padx=(0, 8))

        ghost_button(user_frame, "Switch User", command=self.on_switch_user,
                     height=28).pack(side="left")

        divider(self).pack(fill="x")

        # ── Main content ─────────────────────────────────────────────────────
        content = ctk.CTkFrame(self, fg_color="transparent")
        content.pack(fill="both", expand=True, padx=0, pady=0)
        content.grid_columnconfigure(0, weight=1)
        content.grid_columnconfigure(1, weight=0)
        content.grid_rowconfigure(0, weight=1)

        # Left: jobs panel
        jobs_panel = ctk.CTkFrame(content, fg_color="transparent")
        jobs_panel.grid(row=0, column=0, sticky="nsew", padx=24, pady=20)
        jobs_panel.grid_rowconfigure(2, weight=1)
        jobs_panel.grid_columnconfigure(0, weight=1)

        # Jobs header row
        header = ctk.CTkFrame(jobs_panel, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 12))
        header.grid_columnconfigure(0, weight=1)

        title_label(header, "Projects").grid(row=0, column=0, sticky="w")
        primary_button(header, "+  New Job", command=self.on_new_job,
                       width=110).grid(row=0, column=1, sticky="e")

        # Filter tabs
        filter_frame = ctk.CTkFrame(jobs_panel, fg_color="transparent")
        filter_frame.grid(row=1, column=0, sticky="w", pady=(0, 12))

        self.filter_btns = {}
        for status in ["Active", "Archived", "All"]:
            btn = ctk.CTkButton(
                filter_frame, text=status,
                font=ctk.CTkFont(*FONTS["small"]),
                width=72, height=28, corner_radius=4,
                fg_color=COLORS["accent"] if status == self.status_filter else COLORS["bg_input"],
                hover_color=COLORS["accent_light"],
                text_color=COLORS["text_primary"],
                command=lambda s=status: self._set_filter(s)
            )
            btn.pack(side="left", padx=(0, 6))
            self.filter_btns[status] = btn

        # Job list
        self.job_list = ScrollableCardList(jobs_panel)
        self.job_list.grid(row=2, column=0, sticky="nsew")

        # Right: activity feed panel
        feed_panel = card_frame(content, width=290)
        feed_panel.grid(row=0, column=1, sticky="nsew", padx=(0, 24), pady=20)
        feed_panel.grid_propagate(False)
        feed_panel.grid_rowconfigure(2, weight=1)  # row 2 = scroll frame gets the space
        feed_panel.grid_columnconfigure(0, weight=1)

        section_label(feed_panel, "LIVE ACTIVITY").grid(
            row=0, column=0, sticky="w", padx=14, pady=(14, 8)
        )
        divider(feed_panel).grid(row=1, column=0, sticky="ew", padx=14)

        self.feed_scroll = ctk.CTkScrollableFrame(
            feed_panel, fg_color="transparent",
            scrollbar_button_color=COLORS["border"],
            width=270
        )
        self.feed_scroll.grid(row=2, column=0, sticky="nsew", padx=4, pady=4)

    def _set_filter(self, status: str):
        self.status_filter = status
        for s, btn in self.filter_btns.items():
            btn.configure(
                fg_color=COLORS["accent"] if s == status else COLORS["bg_input"]
            )
        self._render_jobs()

    def refresh(self):
        self._render_jobs()
        self._render_feed()
        # Auto-refresh every 30 seconds
        self.after(30000, self.refresh)

    def _render_jobs(self):
        for w in self.job_list.winfo_children():
            w.destroy()

        jobs = db.get_all_jobs()
        if self.status_filter != "All":
            jobs = [j for j in jobs if j["status"] == self.status_filter]

        if not jobs:
            ctk.CTkLabel(
                self.job_list,
                text="No projects yet.\nClick + New Job to get started.",
                font=ctk.CTkFont(*FONTS["body"]),
                text_color=COLORS["text_muted"],
                justify="center"
            ).pack(pady=40)
            return

        for job in jobs:
            self._render_job_card(job)

    def _render_job_card(self, job: dict):
        card = card_frame(self.job_list)
        card.pack(fill="x", pady=4, padx=2)
        card.grid_columnconfigure(1, weight=1)

        # Colour bar on left
        s_color = self._current_stage_color(job["id"])
        bar = ctk.CTkFrame(card, fg_color=s_color, width=4, corner_radius=0)
        bar.grid(row=0, column=0, rowspan=4, sticky="ns", padx=(0, 12), pady=0)

        # Job number + name
        ctk.CTkLabel(
            card,
            text=f"{job['job_number']}  –  {job['job_name']}",
            font=ctk.CTkFont(*FONTS["heading"]),
            text_color=COLORS["text_primary"],
            anchor="w"
        ).grid(row=0, column=1, sticky="w", padx=(0, 8), pady=(10, 2))

        # Meta row 1: lead + engineer + open actions
        meta = ctk.CTkFrame(card, fg_color="transparent")
        meta.grid(row=1, column=1, sticky="w", pady=(0, 2))

        if job["lead_technician"]:
            muted_label(meta, f"Lead: {job['lead_technician']}").pack(side="left", padx=(0, 12))
        if job["lead_engineer"]:
            muted_label(meta, f"Engineer: {job['lead_engineer']}").pack(side="left", padx=(0, 12))
        if job["open_actions"]:
            ctk.CTkLabel(
                meta, text=f"⚡ {job['open_actions']} open",
                font=ctk.CTkFont(*FONTS["tiny"]),
                text_color=COLORS["warning"]
            ).pack(side="left")

        # Meta row 2: assigned users + next issue date
        meta2 = ctk.CTkFrame(card, fg_color="transparent")
        meta2.grid(row=2, column=1, sticky="w", pady=(0, 2))

        try:
            import json
            assigned = json.loads(job.get("assigned_users") or "[]")
        except Exception:
            assigned = []

        if assigned:
            avatars = "  ".join(f"👤 {u}" for u in assigned[:4])
            if len(assigned) > 4:
                avatars += f"  +{len(assigned)-4}"
            ctk.CTkLabel(
                meta2, text=avatars,
                font=ctk.CTkFont(*FONTS["tiny"]),
                text_color=COLORS["text_secondary"]
            ).pack(side="left", padx=(0, 14))

        nid = job.get("next_issue_date", "")
        if nid:
            ctk.CTkLabel(
                meta2, text=f"📅 Next issue: {nid}",
                font=ctk.CTkFont(*FONTS["tiny"]),
                text_color=COLORS["warning"]
            ).pack(side="left")

        # Bottom row: status + time
        bottom = ctk.CTkFrame(card, fg_color="transparent")
        bottom.grid(row=3, column=1, sticky="ew", pady=(0, 8))
        bottom.grid_columnconfigure(0, weight=1)

        status_badge(bottom, job["status"]).grid(row=0, column=0, sticky="w")
        muted_label(bottom, format_time_ago(job["updated_at"])).grid(
            row=0, column=1, sticky="e", padx=(0, 12)
        )

        # Click handler
        for widget in [card, bar]:
            widget.bind("<Button-1>", lambda e, jid=job["id"]: self.on_open_job(jid))
        card.bind("<Enter>", lambda e: card.configure(fg_color=COLORS["bg_hover"]))
        card.bind("<Leave>", lambda e: card.configure(fg_color=COLORS["bg_panel"]))

    def _current_stage_color(self, job_id: int) -> str:
        from theme import stage_color
        milestones = db.get_milestones(job_id)
        current = "Start"
        for m in milestones:
            if m["is_reached"]:
                current = m["stage"]
        return stage_color(current)

    def _render_feed(self):
        for w in self.feed_scroll.winfo_children():
            w.destroy()

        activity = db.get_activity_feed(limit=40)
        if not activity:
            muted_label(self.feed_scroll, "No activity yet.").pack(pady=16)
            return

        for item in activity:
            self._render_feed_item(item)

    def _render_feed_item(self, item: dict):
        frame = ctk.CTkFrame(self.feed_scroll, fg_color="transparent")
        frame.pack(fill="x", pady=3, padx=4)

        # User dot
        dot = ctk.CTkFrame(frame, fg_color=COLORS["accent"], width=6, height=6,
                           corner_radius=3)
        dot.pack(side="left", anchor="n", padx=(0, 6), pady=4)

        text_frame = ctk.CTkFrame(frame, fg_color="transparent")
        text_frame.pack(side="left", fill="x", expand=True)

        # User + action
        top_line = f"{item['user']}  {item['action']}"
        ctk.CTkLabel(
            text_frame, text=top_line,
            font=ctk.CTkFont(*FONTS["small"]),
            text_color=COLORS["text_secondary"],
            anchor="w", wraplength=220, justify="left"
        ).pack(anchor="w")

        # Job name
        if item["job_name"]:
            ctk.CTkLabel(
                text_frame, text=item["job_name"],
                font=ctk.CTkFont(*FONTS["tiny"]),
                text_color=COLORS["accent"],
                anchor="w"
            ).pack(anchor="w")

        # Time
        ctk.CTkLabel(
            text_frame, text=format_time_ago(item["created_at"]),
            font=ctk.CTkFont(*FONTS["tiny"]),
            text_color=COLORS["text_muted"],
            anchor="w"
        ).pack(anchor="w")

        divider(self.feed_scroll, height=1).pack(fill="x", pady=2)
