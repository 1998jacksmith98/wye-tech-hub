"""
WYE Tech Hub - Job Detail Screen
Timeline + Key Info + Checklist + Information Feed
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import filedialog, messagebox
import os, shutil, json
from datetime import datetime
from theme import COLORS, FONTS, TIMELINE_STAGES, TAG_SOURCES, TAG_TOPICS, TAG_STATUS, CONTENT_TYPES, stage_color
from components import (
    styled_frame, card_frame, section_label, title_label, body_label,
    muted_label, primary_button, ghost_button, danger_button, divider,
    styled_entry, styled_dropdown, styled_textbox, tag_chip, ScrollableCardList
)
import database as db


class JobScreen(ctk.CTkFrame):
    def __init__(self, parent, job_id: int, current_user: str, on_back):
        super().__init__(parent, fg_color=COLORS["bg_dark"])
        self.job_id = job_id
        self.current_user = current_user
        self.on_back = on_back
        self.entry_filters = {}
        self._build()
        self.refresh()

    def _build(self):
        # ── Top bar ──────────────────────────────────────────────────────────
        topbar = styled_frame(self, fg_color=COLORS["bg_mid"], corner_radius=0)
        topbar.pack(fill="x")
        topbar.grid_columnconfigure(1, weight=1)

        ghost_button(topbar, "←  All Projects", command=self.on_back,
                     height=28).grid(row=0, column=0, padx=16, pady=10, sticky="w")

        self.title_lbl = ctk.CTkLabel(
            topbar, text="",
            font=ctk.CTkFont(*FONTS["title"]),
            text_color=COLORS["text_primary"]
        )
        self.title_lbl.grid(row=0, column=1, padx=8, pady=10)

        ctk.CTkLabel(
            topbar, text=f"👤 {self.current_user}",
            font=ctk.CTkFont(*FONTS["small"]),
            text_color=COLORS["text_muted"]
        ).grid(row=0, column=2, padx=16, pady=10, sticky="e")

        divider(self).pack(fill="x")

        # ── Scrollable body ───────────────────────────────────────────────────
        self.body = ctk.CTkScrollableFrame(
            self, fg_color=COLORS["bg_dark"],
            scrollbar_button_color=COLORS["border"]
        )
        self.body.pack(fill="both", expand=True, padx=0, pady=0)
        self.body.grid_columnconfigure(0, weight=1)

    def refresh(self):
        job = db.get_job(self.job_id)
        if not job:
            return
        self.job = job
        self.title_lbl.configure(
            text=f"{job['job_number']}  –  {job['job_name']}"
        )
        # Clear body
        for w in self.body.winfo_children():
            w.destroy()

        self._build_key_info(job)
        self._build_timeline(job)
        self._build_checklist(job)
        self._build_entries(job)

    # ── Key Info ─────────────────────────────────────────────────────────────

    def _build_key_info(self, job):
        outer = card_frame(self.body)
        outer.pack(fill="x", padx=20, pady=(16, 8))

        # Header row
        hdr = ctk.CTkFrame(outer, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 8))
        hdr.grid_columnconfigure(0, weight=1)
        section_label(hdr, "PROJECT INFO").grid(row=0, column=0, sticky="w")
        primary_button(hdr, "Edit Info", command=self._open_edit_job,
                       width=90).grid(row=0, column=1, sticky="e")

        # Fields grid inside a sub-frame
        fields_frame = ctk.CTkFrame(outer, fg_color="transparent")
        fields_frame.pack(fill="x", padx=14, pady=(0, 8))
        fields_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)

        fields = [
            ("Job Number",    job.get("job_number", "")),
            ("Lead Technician", job.get("lead_technician", "")),
            ("Lead Engineer", job.get("lead_engineer", "")),
            ("Client",        job.get("client", "")),
            ("Architect",     job.get("architect", "")),
            ("Arch Software", job.get("architect_software", "")),
            ("Revit Version", job.get("revit_version", "")),
            ("Start Date",    job.get("start_date", "")),
            ("Next Issue Date", job.get("next_issue_date", "")),
            ("Status",        job.get("status", "")),
            ("Created By",    job.get("created_by", "")),
        ]

        for i, (label, value) in enumerate(fields):
            col = i % 4
            row = i // 4
            cell = ctk.CTkFrame(fields_frame, fg_color="transparent")
            cell.grid(row=row, column=col, sticky="w", padx=8, pady=4)
            muted_label(cell, label.upper()).pack(anchor="w")
            v_color = COLORS["warning"] if label == "Next Issue Date" and value else COLORS["text_primary"]
            ctk.CTkLabel(cell, text=value or "—",
                         font=ctk.CTkFont(*FONTS["body"]),
                         text_color=v_color).pack(anchor="w")

        # Assigned users row
        divider(outer).pack(fill="x", padx=14, pady=(4, 8))
        assigned_row = ctk.CTkFrame(outer, fg_color="transparent")
        assigned_row.pack(fill="x", padx=14, pady=(0, 12))
        assigned_row.grid_columnconfigure(1, weight=1)

        muted_label(assigned_row, "ASSIGNED TECHNICIANS").grid(row=0, column=0, sticky="w", padx=(0, 16))

        try:
            import json as _json
            assigned = _json.loads(job.get("assigned_users") or "[]")
        except Exception:
            assigned = []

        users_frame = ctk.CTkFrame(assigned_row, fg_color="transparent")
        users_frame.grid(row=0, column=1, sticky="w")

        if assigned:
            for u in assigned:
                ctk.CTkLabel(
                    users_frame,
                    text=f"  👤 {u}  ",
                    font=ctk.CTkFont(*FONTS["small"]),
                    text_color=COLORS["text_primary"],
                    fg_color=COLORS["accent_dim"],
                    corner_radius=4
                ).pack(side="left", padx=(0, 4))
        else:
            muted_label(users_frame, "No one assigned yet").pack(side="left")

        primary_button(assigned_row, "Manage", command=self._open_assign_users,
                       width=80, height=26).grid(row=0, column=2, sticky="e", padx=(8, 0))

    # ── Timeline ─────────────────────────────────────────────────────────────

    def _build_timeline(self, job):
        outer = card_frame(self.body)
        outer.pack(fill="x", padx=20, pady=8)

        # Use pack throughout this section — no grid mixing
        section_label(outer, "PROJECT TIMELINE").pack(
            anchor="w", padx=14, pady=(12, 4)
        )

        milestones = db.get_milestones(self.job_id)
        if not milestones:
            return

        # Visual timeline bar — uses grid internally (its own container)
        timeline_frame = ctk.CTkFrame(outer, fg_color="transparent")
        timeline_frame.pack(fill="x", padx=14, pady=8)

        # Build milestones list including Start
        all_stages = []
        all_stages.append({
            "stage": "Start",
            "is_reached": 1,
            "confirmed_date": job.get("start_date", ""),
            "target_date": job.get("start_date", ""),
            "id": None
        })
        all_stages.extend(milestones)

        n = len(all_stages)
        for i, m in enumerate(all_stages):
            col = i * 2
            timeline_frame.grid_columnconfigure(col, weight=0, minsize=90)
            if i < n - 1:
                timeline_frame.grid_columnconfigure(col + 1, weight=1)

            is_reached = bool(m["is_reached"])
            color = stage_color(m["stage"]) if is_reached else COLORS["text_muted"]

            # Circle node — uses pack internally (its own container)
            node_frame = ctk.CTkFrame(timeline_frame, fg_color="transparent")
            node_frame.grid(row=0, column=col, padx=4, pady=4)

            node = ctk.CTkFrame(
                node_frame,
                fg_color=color if is_reached else COLORS["bg_input"],
                border_color=color, border_width=2,
                width=28, height=28, corner_radius=14
            )
            node.pack()
            node.pack_propagate(False)
            if is_reached:
                ctk.CTkLabel(node, text="✓", font=ctk.CTkFont("Inter", 11, "bold"),
                             text_color="white").place(relx=0.5, rely=0.5, anchor="center")

            ctk.CTkLabel(
                node_frame, text=m["stage"],
                font=ctk.CTkFont(*FONTS["tiny"]),
                text_color=color if is_reached else COLORS["text_muted"],
                wraplength=85, justify="center"
            ).pack(pady=(3, 0))

            date_str = m.get("confirmed_date") or m.get("target_date") or ""
            if date_str:
                ctk.CTkLabel(
                    node_frame, text=date_str,
                    font=ctk.CTkFont(*FONTS["tiny"]),
                    text_color=COLORS["text_muted"]
                ).pack()

            if m["id"] is not None:
                node_frame.bind("<Button-1>",
                    lambda e, ms=m: self._open_milestone_editor(ms))
                node.bind("<Button-1>",
                    lambda e, ms=m: self._open_milestone_editor(ms))

            # Connector line
            if i < n - 1:
                line_color = color if is_reached else COLORS["border"]
                line = ctk.CTkFrame(timeline_frame, fg_color=line_color, height=2)
                line.grid(row=0, column=col + 1, sticky="ew", pady=20)

        muted_label(outer, "Click a milestone to update dates or mark as reached.").pack(
            anchor="w", padx=14, pady=(0, 12)
        )

    # ── Checklist ─────────────────────────────────────────────────────────────

    def _build_checklist(self, job):
        outer = card_frame(self.body)
        outer.pack(fill="x", padx=20, pady=8)

        # Header
        hdr = ctk.CTkFrame(outer, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 8))
        hdr.grid_columnconfigure(0, weight=1)
        section_label(hdr, "ACTION CHECKLIST").grid(row=0, column=0, sticky="w")
        primary_button(hdr, "+  Add Item", command=self._open_add_checklist,
                       width=100, height=28).grid(row=0, column=1, sticky="e")

        items = db.get_checklist(self.job_id)
        if not items:
            muted_label(outer, "No action items yet.").pack(
                anchor="w", padx=14, pady=(0, 12)
            )
            return

        for item in items:
            self._render_checklist_item(outer, item)

    def _render_checklist_item(self, parent, item):
        frame = ctk.CTkFrame(parent, fg_color=COLORS["bg_input"], corner_radius=6)
        frame.pack(fill="x", padx=14, pady=2)

        inner = ctk.CTkFrame(frame, fg_color="transparent")
        inner.pack(fill="x", padx=6, pady=6)
        inner.grid_columnconfigure(1, weight=1)

        # Checkbox
        var = ctk.BooleanVar(value=bool(item["is_complete"]))
        cb = ctk.CTkCheckBox(
            inner, text="", variable=var,
            fg_color=COLORS["success"], hover_color=COLORS["accent"],
            border_color=COLORS["border"],
            width=20, height=20,
            command=lambda v=var, i=item: self._toggle_item(i["id"], v.get(), i)
        )
        cb.grid(row=0, column=0, padx=(4, 8))

        text_color = COLORS["text_muted"] if item["is_complete"] else COLORS["text_primary"]
        text = item["text"]
        if item["assigned_to"]:
            text += f"  →  {item['assigned_to']}"
        ctk.CTkLabel(
            inner, text=text,
            font=ctk.CTkFont(*FONTS["body"]),
            text_color=text_color,
            anchor="w"
        ).grid(row=0, column=1, sticky="w")

        meta_parts = [f"Added by {item['created_by']}"]
        if item["is_complete"] and item["completed_by"]:
            meta_parts.append(f"Done by {item['completed_by']}")
        muted_label(inner, "  ·  ".join(meta_parts)).grid(row=0, column=2, padx=(0, 6))

        ctk.CTkButton(
            inner, text="✕", width=24, height=24,
            fg_color="transparent", hover_color=COLORS["danger"],
            text_color=COLORS["text_muted"],
            command=lambda i=item["id"]: self._delete_checklist(i)
        ).grid(row=0, column=3, padx=(0, 4))

    def _toggle_item(self, item_id, is_complete, item):
        db.toggle_checklist_item(
            item_id, is_complete, self.current_user,
            self.job_id, self.job["job_name"]
        )
        self.refresh()

    def _delete_checklist(self, item_id):
        if messagebox.askyesno("Delete", "Remove this action item?"):
            db.delete_checklist_item(item_id, self.job_id)
            self.refresh()

    # ── Entries / Info Feed ────────────────────────────────────────────────────

    def _build_entries(self, job):
        outer = card_frame(self.body)
        outer.pack(fill="x", padx=20, pady=(8, 20))

        # Header
        hdr = ctk.CTkFrame(outer, fg_color="transparent")
        hdr.pack(fill="x", padx=14, pady=(12, 8))
        hdr.grid_columnconfigure(0, weight=1)
        section_label(hdr, "INFORMATION FEED").grid(row=0, column=0, sticky="w")
        primary_button(hdr, "+  Add Entry", command=self._open_add_entry,
                       width=110, height=28).grid(row=0, column=1, sticky="e")

        # Filter bar
        self._build_filter_bar(outer)

        # Entries
        entries = db.get_entries(self.job_id, self.entry_filters if self.entry_filters else None)

        if not entries:
            muted_label(outer, "No entries yet. Add notes, screenshots, PDFs and more.").pack(
                anchor="w", padx=14, pady=(0, 12)
            )
            return

        for entry in entries:
            self._render_entry(outer, entry)

    def _build_filter_bar(self, parent):
        bar = ctk.CTkFrame(parent, fg_color=COLORS["bg_input"], corner_radius=6)
        bar.pack(fill="x", padx=14, pady=(0, 8))
        bar.grid_columnconfigure((1, 3, 5), weight=1)

        filters = [
            ("Source", "source", TAG_SOURCES),
            ("Topic", "topic", TAG_TOPICS),
            ("Status", "status", TAG_STATUS),
        ]

        # Get any free-text tags that have been used
        for i, (label, key, options) in enumerate(filters):
            col = i * 2
            muted_label(bar, label).grid(row=0, column=col, padx=(10, 4), pady=6)

            # Collect all used values for this tag key
            used = db.get_all_tag_values(self.job_id, key)
            all_opts = ["All"] + options
            for u in used:
                if u not in all_opts:
                    all_opts.append(u)

            current = self.entry_filters.get(key, "All")
            if current not in all_opts:
                current = "All"

            dd = styled_dropdown(
                bar, values=all_opts,
                height=28, width=140,
                command=lambda val, k=key: self._apply_filter(k, val)
            )
            dd.set(current)
            dd.grid(row=0, column=col + 1, padx=(0, 8), pady=4)

        ghost_button(bar, "Clear Filters", command=self._clear_filters,
                     height=26, width=90).grid(row=0, column=6, padx=(0, 8), pady=4)

    def _apply_filter(self, key, val):
        if val == "All":
            self.entry_filters.pop(key, None)
        else:
            self.entry_filters[key] = val
        self.refresh()

    def _clear_filters(self):
        self.entry_filters = {}
        self.refresh()

    def _render_entry(self, parent, entry):
        frame = ctk.CTkFrame(parent, fg_color=COLORS["bg_input"], corner_radius=6)
        frame.pack(fill="x", padx=14, pady=3)

        # Detect if there's an image to show
        file_path = entry.get("file_path", "")
        file_name = entry.get("file_name", "") or ""
        is_image = file_path and os.path.exists(file_path) and \
                   file_name.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp"))

        # Two-column layout when image present: left=content, right=thumbnail
        frame.grid_columnconfigure(0, weight=1)
        if is_image:
            frame.grid_columnconfigure(1, weight=0)

        # ── Left column: all content ──────────────────────────────────────────
        left = ctk.CTkFrame(frame, fg_color="transparent")
        left.grid(row=0, column=0, sticky="nsew", padx=(10, 4), pady=8)
        left.grid_columnconfigure(0, weight=1)

        # Header: badge + user/time + delete
        top = ctk.CTkFrame(left, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew")
        top.grid_columnconfigure(1, weight=1)

        ct = entry.get("content_type", "note")
        ct_color = {
            "note": COLORS["accent_dim"],
            "screenshot": COLORS["stage_s3"],
            "pdf": COLORS["danger"],
            "email (.msg)": COLORS["stage_s5"],
            "email": COLORS["stage_s5"],
            "teams message": COLORS["stage_s4"],
            "call note": COLORS["warning"],
            "file": COLORS["text_muted"],
        }.get(ct.lower(), COLORS["accent_dim"])

        ctk.CTkLabel(
            top, text=f"  {ct.upper()}  ",
            font=ctk.CTkFont(*FONTS["tiny"]),
            text_color=COLORS["text_primary"],
            fg_color=ct_color, corner_radius=3
        ).grid(row=0, column=0, padx=(0, 8))

        ctk.CTkLabel(
            top,
            text=f"{entry['created_by']}  ·  {entry['created_at'][:16].replace('T', '  ')}",
            font=ctk.CTkFont(*FONTS["small"]),
            text_color=COLORS["text_secondary"],
            anchor="w"
        ).grid(row=0, column=1, sticky="w")

        ctk.CTkButton(
            top, text="✕", width=24, height=20,
            fg_color="transparent", hover_color=COLORS["danger"],
            text_color=COLORS["text_muted"],
            command=lambda eid=entry["id"]: self._delete_entry(eid)
        ).grid(row=0, column=2, sticky="e")

        # Text content — wraplength tighter when image present
        wrap = 580 if is_image else 900
        if entry.get("text_content"):
            ctk.CTkLabel(
                left, text=entry["text_content"],
                font=ctk.CTkFont(*FONTS["body"]),
                text_color=COLORS["text_primary"],
                anchor="w", wraplength=wrap, justify="left"
            ).grid(row=1, column=0, sticky="w", pady=(4, 2))

        # File attachment button (non-image files only, or if path missing)
        if file_name and not is_image:
            ghost_button(
                left,
                text=f"📎  {file_name}",
                command=lambda fp=file_path: self._open_file(fp),
                height=26
            ).grid(row=2, column=0, sticky="w", pady=(0, 2))
        elif file_name and is_image:
            # Show filename as small muted text under the thumbnail hint
            muted_label(left, f"📎  {file_name}").grid(
                row=2, column=0, sticky="w", pady=(0, 2)
            )

        # Link button
        link = entry.get("link_url", "")
        if link:
            is_email_link = link.lower().startswith("outlook:") or \
                            "outlook" in link.lower() or \
                            entry.get("content_type", "").lower() == "email"
            icon = "✉️" if is_email_link else "🔗"
            label = "Open in Outlook" if is_email_link else "Open Link"
            ctk.CTkButton(
                left,
                text=f"{icon}  {label}",
                font=ctk.CTkFont(*FONTS["small"]),
                fg_color=COLORS["accent_dim"],
                hover_color=COLORS["accent"],
                text_color=COLORS["text_primary"],
                corner_radius=4, height=26,
                command=lambda u=link: self._open_link(u)
            ).grid(row=3, column=0, sticky="w", pady=(0, 2))

        # Tags
        tags = entry.get("tags", {})
        if tags:
            tag_row = ctk.CTkFrame(left, fg_color="transparent")
            tag_row.grid(row=4, column=0, sticky="w", pady=(4, 0))
            tag_colors = {
                "source": COLORS["accent_dim"],
                "person": "#2B4A2B",
                "topic": "#3A2B4A",
                "status": {
                    "Action Required": "#4A2B2B",
                    "Resolved": "#2B4A35",
                    "Pending": "#4A3B2B",
                    "FYI": COLORS["accent_dim"]
                }.get(tags.get("status", ""), COLORS["accent_dim"])
            }
            for key, val in tags.items():
                if val:
                    color = tag_colors.get(key, COLORS["accent_dim"])
                    if key == "status":
                        color = tag_colors["status"]
                    chip = tag_chip(tag_row, key.upper(), val, color)
                    chip.pack(side="left", padx=(0, 4))

        # ── Right column: image thumbnail ─────────────────────────────────────
        if is_image:
            try:
                from PIL import Image, ImageTk
                img = Image.open(file_path)
                thumb_w, thumb_h = 200, 130
                img.thumbnail((thumb_w, thumb_h), Image.LANCZOS)
                photo = ImageTk.PhotoImage(img)

                thumb_frame = ctk.CTkFrame(
                    frame,
                    fg_color=COLORS["bg_dark"],
                    corner_radius=6,
                    cursor="hand2"
                )
                thumb_frame.grid(row=0, column=1, padx=(0, 10), pady=8, sticky="ns")

                lbl = ctk.CTkLabel(thumb_frame, image=photo, text="")
                lbl.image = photo  # keep reference
                lbl.pack(padx=4, pady=4)

                # Click thumbnail to open full image
                for widget in (thumb_frame, lbl):
                    widget.bind("<Button-1>",
                        lambda e, fp=file_path: self._open_file(fp))

                muted_label(thumb_frame, "click to open").pack(pady=(0, 4))

            except Exception:
                # If thumbnail fails for any reason, skip silently
                pass

    def _open_file(self, path):
        if path and os.path.exists(path):
            os.startfile(path) if os.name == "nt" else os.system(f'xdg-open "{path}"')
        else:
            messagebox.showwarning("File not found", "The attached file could not be located.")

    def _open_link(self, url: str):
        """Opens a link — uses webbrowser for https, os.startfile for outlook: protocol."""
        import webbrowser
        try:
            if url.lower().startswith("outlook:"):
                # Outlook protocol link — open directly via OS
                if os.name == "nt":
                    os.startfile(url)
                else:
                    os.system(f'open "{url}"')
            else:
                webbrowser.open(url)
        except Exception as e:
            messagebox.showwarning("Could not open link", str(e))

    def _delete_entry(self, entry_id):
        if messagebox.askyesno("Delete Entry", "Remove this entry permanently?"):
            db.delete_entry(entry_id, self.job_id)
            self.refresh()

    # ── Dialogs ────────────────────────────────────────────────────────────────

    def _open_edit_job(self):
        EditJobDialog(self, self.job, self.current_user, on_save=self.refresh)

    def _open_add_checklist(self):
        AddChecklistDialog(self, self.job_id, self.job["job_name"],
                           self.current_user, on_save=self.refresh)

    def _open_add_entry(self):
        AddEntryDialog(self, self.job_id, self.job["job_name"],
                       self.current_user, on_save=self.refresh)

    def _open_milestone_editor(self, milestone):
        MilestoneDialog(self, milestone, self.job_id, self.job["job_name"],
                        self.current_user, on_save=self.refresh)

    def _open_assign_users(self):
        AssignUsersDialog(self, self.job_id, self.job["job_name"],
                          self.current_user, on_save=self.refresh)


# ── Dialogs ────────────────────────────────────────────────────────────────────

class BaseDialog(ctk.CTkToplevel):
    def __init__(self, parent, title: str, width=500, height=500):
        super().__init__(parent)
        self.title(title)
        self.geometry(f"{width}x{height}")
        self.configure(fg_color=COLORS["bg_mid"])
        self.resizable(True, True)
        self.grab_set()

        self.scroll = ctk.CTkScrollableFrame(
            self, fg_color="transparent",
            scrollbar_button_color=COLORS["border"]
        )
        self.scroll.pack(fill="both", expand=True, padx=20, pady=20)
        self.scroll.grid_columnconfigure(0, weight=1)
        self._row = 0

    def _add_label(self, text):
        muted_label(self.scroll, text.upper()).grid(
            row=self._row, column=0, sticky="w", pady=(10, 2)
        )
        self._row += 1

    def _add_entry(self, placeholder="", default=""):
        e = styled_entry(self.scroll, placeholder=placeholder)
        e.grid(row=self._row, column=0, sticky="ew", pady=(0, 2))
        if default:
            e.insert(0, default)
        self._row += 1
        return e

    def _add_dropdown(self, values, default=None):
        dd = styled_dropdown(self.scroll, values=values)
        dd.grid(row=self._row, column=0, sticky="ew", pady=(0, 2))
        if default and default in values:
            dd.set(default)
        else:
            dd.set(values[0])
        self._row += 1
        return dd

    def _add_textbox(self, height=80):
        tb = styled_textbox(self.scroll, height=height)
        tb.grid(row=self._row, column=0, sticky="ew", pady=(0, 2))
        self._row += 1
        return tb

    def _add_save_btn(self, text="Save", command=None):
        primary_button(self.scroll, text, command=command).grid(
            row=self._row, column=0, sticky="ew", pady=(16, 0)
        )
        self._row += 1


class EditJobDialog(BaseDialog):
    def __init__(self, parent, job, user, on_save):
        super().__init__(parent, "Edit Job Info", width=520, height=660)
        self.job = job
        self.user = user
        self.on_save = on_save
        from theme import ARCHITECT_SOFTWARES, REVIT_VERSIONS, TEAM_MEMBERS

        self._add_label("Job Number")
        self.e_num = self._add_entry(default=job.get("job_number", ""))
        self._add_label("Job Name")
        self.e_name = self._add_entry(default=job.get("job_name", ""))
        self._add_label("Status")
        self.e_status = self._add_dropdown(["Active", "Archived"], job.get("status"))
        self._add_label("Lead Technician")
        self.e_lead_tech = self._add_dropdown(TEAM_MEMBERS, job.get("lead_technician"))
        self._add_label("Lead Engineer")
        self.e_lead_eng = self._add_entry(default=job.get("lead_engineer", ""))
        self._add_label("Client")
        self.e_client = self._add_entry(default=job.get("client", ""))
        self._add_label("Architect")
        self.e_arch = self._add_entry(default=job.get("architect", ""))
        self._add_label("Architect Software")
        self.e_arch_sw = self._add_dropdown(ARCHITECT_SOFTWARES, job.get("architect_software"))
        self._add_label("Revit Version")
        self.e_revit = self._add_dropdown(REVIT_VERSIONS, job.get("revit_version"))
        self._add_label("Start Date (DD/MM/YYYY)")
        self.e_start = self._add_entry(default=job.get("start_date", ""))
        self._add_label("Next Issue Date (DD/MM/YYYY)")
        self.e_next_issue = self._add_entry(default=job.get("next_issue_date", ""))
        self._add_save_btn("Save Changes", self._save)

    def _save(self):
        data = {
            "job_number": self.e_num.get().strip(),
            "job_name": self.e_name.get().strip(),
            "status": self.e_status.get(),
            "lead_technician": self.e_lead_tech.get(),
            "lead_engineer": self.e_lead_eng.get().strip(),
            "client": self.e_client.get().strip(),
            "architect": self.e_arch.get().strip(),
            "architect_software": self.e_arch_sw.get(),
            "revit_version": self.e_revit.get(),
            "start_date": self.e_start.get().strip(),
            "next_issue_date": self.e_next_issue.get().strip(),
        }
        db.update_job(self.job["id"], data, self.user)
        self.on_save()
        self.destroy()


class MilestoneDialog(BaseDialog):
    def __init__(self, parent, milestone, job_id, job_name, user, on_save):
        super().__init__(parent, f"Update — {milestone['stage']}", width=420, height=380)
        self.milestone = milestone
        self.job_id = job_id
        self.job_name = job_name
        self.user = user
        self.on_save = on_save

        title_label(self.scroll, milestone["stage"]).grid(
            row=0, column=0, sticky="w", pady=(0, 12)
        )
        self._row = 1

        self._add_label("Target Date (DD/MM/YYYY)")
        self.e_target = self._add_entry(default=milestone.get("target_date") or "")
        self._add_label("Confirmed Issue Date (DD/MM/YYYY)")
        self.e_confirmed = self._add_entry(default=milestone.get("confirmed_date") or "")
        self._add_label("Notes")
        self.e_notes = self._add_textbox(height=60)
        if milestone.get("notes"):
            self.e_notes.insert("0.0", milestone["notes"])

        # Reached toggle
        self.reached_var = ctk.BooleanVar(value=bool(milestone["is_reached"]))
        ctk.CTkCheckBox(
            self.scroll, text="Mark as Reached",
            variable=self.reached_var,
            fg_color=COLORS["success"], hover_color=COLORS["accent"],
            font=ctk.CTkFont(*FONTS["body"]),
            text_color=COLORS["text_primary"]
        ).grid(row=self._row, column=0, sticky="w", pady=8)
        self._row += 1
        self._add_save_btn("Update Milestone", self._save)

    def _save(self):
        db.update_milestone(
            self.milestone["id"],
            self.e_target.get().strip(),
            self.e_confirmed.get().strip(),
            int(self.reached_var.get()),
            self.e_notes.get("0.0", "end").strip(),
            self.user, self.job_name, self.job_id
        )
        self.on_save()
        self.destroy()


class AddChecklistDialog(BaseDialog):
    def __init__(self, parent, job_id, job_name, user, on_save):
        super().__init__(parent, "Add Action Item", width=440, height=300)
        self.job_id = job_id
        self.job_name = job_name
        self.user = user
        self.on_save = on_save
        from theme import TEAM_MEMBERS

        self._add_label("Action Item")
        self.e_text = self._add_textbox(height=80)
        self._add_label("Assign To")
        self.e_assign = self._add_dropdown(["Unassigned"] + TEAM_MEMBERS)
        self._add_save_btn("Add Item", self._save)

    def _save(self):
        text = self.e_text.get("0.0", "end").strip()
        if not text:
            messagebox.showwarning("Required", "Please enter an action item.")
            return
        assigned = self.e_assign.get()
        if assigned == "Unassigned":
            assigned = ""
        db.add_checklist_item(self.job_id, text, assigned, self.user, self.job_name)
        self.on_save()
        self.destroy()


class AddEntryDialog(BaseDialog):
    def __init__(self, parent, job_id, job_name, user, on_save):
        super().__init__(parent, "Add Information Entry", width=520, height=640)
        self.job_id = job_id
        self.job_name = job_name
        self.user = user
        self.on_save = on_save
        self.file_path = None
        self.file_name = None

        self._add_label("Content Type")
        self.e_type = self._add_dropdown(CONTENT_TYPES)

        self._add_label("Notes / Text Content")
        self.e_text = self._add_textbox(height=100)

        # File attach + clipboard paste
        file_frame = ctk.CTkFrame(self.scroll, fg_color="transparent")
        file_frame.grid(row=self._row, column=0, sticky="ew", pady=4)
        file_frame.grid_columnconfigure(2, weight=1)
        ghost_button(file_frame, "📎  Attach File", command=self._pick_file,
                     width=120).grid(row=0, column=0, padx=(0, 6))
        ghost_button(file_frame, "📋  Paste Image", command=self._paste_clipboard,
                     width=120).grid(row=0, column=1, padx=(0, 8))
        self.file_lbl = muted_label(file_frame, "No file attached")
        self.file_lbl.grid(row=0, column=2, sticky="w")
        self._row += 1

        # Tags
        muted_label(self.scroll, "─── TAGS ──────────────────").grid(
            row=self._row, column=0, sticky="w", pady=(12, 4)
        )
        self._row += 1

        self._add_label("Source")
        self.e_source = self._add_dropdown(["—"] + TAG_SOURCES)
        self._add_label("Engineer's Name")
        self.e_person_txt = self._add_entry(placeholder="e.g. Tom Harris")
        self._add_label("Topic / What")
        self.e_topic_dd = self._add_dropdown(["—"] + TAG_TOPICS)
        self._add_label("  or type a topic")
        self.e_topic_txt = self._add_entry(placeholder="Free text topic...")
        self._add_label("Status")
        self.e_status = self._add_dropdown(["—"] + TAG_STATUS)

        self._add_label("Link (optional — paste Outlook or Teams URL)")
        self.e_link = self._add_entry(placeholder="e.g. https://... or outlook:...")

        self._add_save_btn("Add Entry", self._save)

    def _pick_file(self):
        path = filedialog.askopenfilename(
            title="Attach file",
            filetypes=[
                ("All files", "*.*"),
                ("Outlook Email", "*.msg"),
                ("Images", "*.png *.jpg *.jpeg *.gif *.bmp"),
                ("PDFs", "*.pdf"),
                ("Documents", "*.docx *.doc *.xlsx *.xls *.txt"),
            ]
        )
        if path:
            self.file_path = path
            self.file_name = os.path.basename(path)
            self.file_lbl.configure(text=self.file_name)

    def _paste_clipboard(self):
        """Grab an image from the clipboard and save it as a PNG to the attachments folder."""
        try:
            from PIL import ImageGrab
            img = ImageGrab.grabclipboard()
            if img is None:
                messagebox.showwarning(
                    "No image found",
                    "No image found on clipboard.\n\nIn Revit or any app, press PrtScn or use "
                    "Snipping Tool, then come back and click Paste Image."
                )
                return
            # Save to attachments folder
            data_dir = os.path.join(os.path.dirname(db.get_db_path()), "attachments")
            os.makedirs(data_dir, exist_ok=True)
            fname = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            dest = os.path.join(data_dir, fname)
            img.save(dest, "PNG")
            self.file_path = dest
            self.file_name = fname
            self.file_lbl.configure(text=f"✓  {fname}", text_color=COLORS["success"])
            # Auto-set content type to Screenshot
            self.e_type.set("Screenshot")
        except ImportError:
            messagebox.showerror(
                "Missing library",
                "Pillow is required for clipboard paste.\nRun: pip install Pillow"
            )
        except Exception as e:
            messagebox.showerror("Clipboard error", str(e))

    def _save(self):
        text = self.e_text.get("0.0", "end").strip()
        if not text and not self.file_path:
            messagebox.showwarning("Required", "Please add text or attach a file.")
            return

        person = self.e_person_txt.get().strip()
        topic = self.e_topic_txt.get().strip() or (
            self.e_topic_dd.get() if self.e_topic_dd.get() != "—" else ""
        )
        tags = {}
        if self.e_source.get() != "—":
            tags["source"] = self.e_source.get()
        if person:
            tags["person"] = person
        if topic:
            tags["topic"] = topic
        if self.e_status.get() != "—":
            tags["status"] = self.e_status.get()

        # Copy file to data dir next to DB
        saved_path = None
        if self.file_path:
            data_dir = os.path.join(os.path.dirname(db.get_db_path()), "attachments")
            os.makedirs(data_dir, exist_ok=True)
            dest = os.path.join(data_dir, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self.file_name}")
            shutil.copy2(self.file_path, dest)
            saved_path = dest

        db.add_entry(
            self.job_id, self.e_type.get().lower(), text,
            saved_path, self.file_name, tags, self.user, self.job_name,
            link_url=self.e_link.get().strip()
        )
        self.on_save()
        self.destroy()

class AssignUsersDialog(ctk.CTkToplevel):
    """Checkbox list to assign / unassign team members to a job."""
    def __init__(self, parent, job_id, job_name, current_user, on_save):
        super().__init__(parent)
        self.title("Assign Technicians")
        self.geometry("360x480")
        self.configure(fg_color=COLORS["bg_mid"])
        self.resizable(True, True)
        self.grab_set()
        self.job_id = job_id
        self.job_name = job_name
        self.current_user = current_user
        self.on_save = on_save

        from theme import TEAM_MEMBERS
        self.members = TEAM_MEMBERS
        self.current = db.get_assigned_users(job_id)
        self.vars = {}

        # Title
        ctk.CTkLabel(
            self, text="Who is working on this job?",
            font=ctk.CTkFont(*FONTS["heading"]),
            text_color=COLORS["text_primary"]
        ).pack(padx=20, pady=(20, 4), anchor="w")

        muted_label(self, "Tick to assign, untick to remove.").pack(
            padx=20, pady=(0, 12), anchor="w"
        )

        scroll = ctk.CTkScrollableFrame(
            self, fg_color=COLORS["bg_input"], corner_radius=8,
            scrollbar_button_color=COLORS["border"]
        )
        scroll.pack(fill="both", expand=True, padx=20, pady=(0, 12))

        for member in self.members:
            var = ctk.BooleanVar(value=(member in self.current))
            self.vars[member] = var
            ctk.CTkCheckBox(
                scroll, text=member,
                variable=var,
                fg_color=COLORS["success"],
                hover_color=COLORS["accent"],
                border_color=COLORS["border"],
                font=ctk.CTkFont(*FONTS["body"]),
                text_color=COLORS["text_primary"]
            ).pack(anchor="w", padx=12, pady=6)

        primary_button(self, "Save", command=self._save).pack(
            fill="x", padx=20, pady=(0, 20)
        )

    def _save(self):
        selected = [m for m, v in self.vars.items() if v.get()]
        db.set_assigned_users(self.job_id, selected, self.current_user, self.job_name)
        self.on_save()
        self.destroy()
