# -*- coding: utf-8 -*-
from __future__ import print_function
import os
import clr
clr.AddReference("System")
clr.AddReference("System.Drawing")
clr.AddReference("System.Windows.Forms")
from System.Drawing import Point, Size
from System.Windows.Forms import (
    Button,
    CheckBox,
    ComboBox,
    ComboBoxStyle,
    DialogResult,
    Form,
    FormBorderStyle,
    FormStartPosition,
    Label,
    ListBox,
    ScrollBars,
    TextBox,
)

from wyetechhub import api, config, job, theme


def alert(message, title="Tech Hub"):
    try:
        from Autodesk.Revit.UI import TaskDialog
        TaskDialog.Show(title, str(message)[:1000])
    except Exception:
        print(message)


def open_url(url):
    os.startfile(str(url))


def open_hub():
    if not ensure_connected():
        raise Exception("Connect Tech Hub in Settings first.")
    cfg = config.load()
    url = cfg.get("hubUrl") or ""
    if not url:
        raise Exception("No Tech Hub URL in Settings.")
    open_url(url + "/app")


def ensure_connected():
    if config.is_ready():
        return True
    show_settings()
    return config.is_ready()


def require_job():
    if not ensure_connected():
        raise Exception("Connect Tech Hub in Settings first.")
    number = job.current_job_number()
    if not number:
        raise Exception(
            "Could not read a job number (J####) from the file name or "
            "Project Number parameter."
        )
    return api.get_job(number), number


def _label(text, x, y, w=120, bold=False, muted=False):
    lbl = Label()
    lbl.Text = text
    lbl.Location = Point(x, y)
    lbl.Size = Size(w, 20)
    theme.style_label(lbl, bold=bold, muted=muted)
    return lbl


def _textbox(x, y, w, h=24, multiline=False):
    box = TextBox()
    box.Location = Point(x, y)
    box.Size = Size(w, h)
    box.Multiline = multiline
    if multiline:
        box.AcceptsReturn = True
        box.ScrollBars = ScrollBars.Vertical
    theme.style_textbox(box)
    return box


def _combo(x, y, w, items, selected=None, blank=True):
    combo = ComboBox()
    combo.DropDownStyle = ComboBoxStyle.DropDownList
    combo.Location = Point(x, y)
    combo.Size = Size(w, 24)
    if blank:
        combo.Items.Add("—")
    for item in items or []:
        combo.Items.Add(item)
    if selected and selected in [str(i) for i in (items or [])]:
        combo.SelectedItem = selected
    elif combo.Items.Count > 0:
        combo.SelectedIndex = 0
    theme.style_combo(combo)
    return combo


def _combo_value(combo):
    value = combo.SelectedItem
    return str(value) if value is not None else "—"


def _button(text, x, y, w=110, h=32, primary=False):
    btn = Button()
    btn.Text = text
    btn.Location = Point(x, y)
    btn.Size = Size(w, h)
    if primary:
        theme.style_button_primary(btn)
    else:
        theme.style_button_secondary(btn)
    return btn


def _checkbox(text, x, y, w=600, checked=True):
    box = CheckBox()
    box.Text = text
    box.Location = Point(x, y)
    box.Size = Size(w, 36)
    box.Checked = checked
    box.Font = theme.font(9)
    box.ForeColor = theme.TEXT
    box.BackColor = theme.BG
    return box


def _attach_screenshot(form, shot, shot_label):
    def on_capture(sender, args):
        from wyetechhub import screenshot
        form.Hide()
        try:
            b64 = screenshot.capture_region_png_base64()
        finally:
            form.Show()
            form.Activate()
        if b64:
            shot["b64"] = b64
            shot_label.Text = "Screenshot attached — it will upload with this item."
        else:
            shot_label.Text = "Screenshot cancelled."
    return on_capture


def show_settings():
    current = config.load()
    form = Form()
    form.Text = "Tech Hub Settings  v0.3"
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(520, 210)
    form.FormBorderStyle = FormBorderStyle.FixedDialog
    form.MaximizeBox = False
    theme.style_form(form)

    form.Controls.Add(_label("Tech Hub website URL", 20, 18, 400))
    url_box = _textbox(20, 40, 480)
    url_box.Text = current.get("hubUrl") or "https://wye-tech-hub.vercel.app"
    form.Controls.Add(url_box)

    form.Controls.Add(_label("Revit token (from Tech Hub → Revit)", 20, 78, 400))
    token_box = _textbox(20, 100, 480)
    token_box.Text = current.get("token") or ""
    form.Controls.Add(token_box)

    save_btn = _button("Save", 310, 150, 90, 30, primary=True)

    cancel_btn = _button("Cancel", 410, 150, 90, 30)
    cancel_btn.DialogResult = DialogResult.Cancel

    def on_save(sender, args):
        config.save(url_box.Text, token_box.Text)
        try:
            who = api.me()
            name = (who.get("user") or {}).get("name") or "connected"
            alert("Connected as " + name + ".")
            form.DialogResult = DialogResult.OK
            form.Close()
        except Exception as exc:
            alert(str(exc))

    save_btn.Click += on_save
    form.Controls.Add(save_btn)
    form.Controls.Add(cancel_btn)
    form.AcceptButton = save_btn
    form.CancelButton = cancel_btn
    form.ShowDialog()


def show_this_job():
    data, number = require_job()
    form = Form()
    form.Text = "Tech Hub — This job"
    form.StartPosition = FormStartPosition.CenterScreen
    form.MaximizeBox = False
    theme.style_form(form)

    lines = [
        "Job: {0}  {1}".format(data.get("jobNumber") or number, data.get("jobName") or ""),
        "Board: {0}".format(data.get("boardColumnName") or "Unassigned"),
        "Next issue: {0}".format(data.get("nextIssueDate") or "—"),
        "Lead engineer: {0}".format(data.get("leadEngineer") or "—"),
        "Open checklist items: {0}".format(data.get("openChecklistCount") or 0),
    ]
    assignees = data.get("assignees") or []
    if assignees:
        names = ", ".join([a.get("name") or a.get("email") or "?" for a in assignees])
        lines.append("Assigned: " + names)

    info = Label()
    info.Location = Point(20, 18)
    # AutoSize + a width cap (0 = no height cap) means the label grows
    # downward to fit however tall the text actually renders, instead
    # of clipping at a hardcoded pixel height that assumed the old font.
    info.MaximumSize = Size(480, 0)
    info.AutoSize = True
    info.Text = "\n".join(lines)
    theme.style_label(info)
    form.Controls.Add(info)

    button_y = info.Bottom + 20

    def add_btn(text, x, click):
        btn = _button(text, x, button_y, 110, 32)
        btn.Click += click
        form.Controls.Add(btn)
        return btn

    add_btn("Move stage", 20, lambda s, a: (form.Close(), show_move_stage()))
    add_btn("Checklist", 140, lambda s, a: (form.Close(), show_checklist()))
    add_btn("New note", 260, lambda s, a: (form.Close(), show_new_note()))
    add_btn("Open hub", 380, lambda s, a: open_url(data.get("hubUrl")))

    close_y = button_y + 50
    close_btn = _button("Close", 400, close_y, 90, 30, primary=True)
    close_btn.DialogResult = DialogResult.Cancel
    form.Controls.Add(close_btn)

    form.ClientSize = Size(520, close_y + 50)
    form.ShowDialog()


def show_move_stage():
    data, number = require_job()
    meta = api.meta()
    columns = meta.get("columns") or []

    form = Form()
    form.Text = "Move stage — " + (data.get("jobName") or number)
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(420, 80 + max(len(columns), 1) * 40)
    form.MaximizeBox = False
    theme.style_form(form)

    current = Label()
    current.Location = Point(20, 15)
    current.Size = Size(380, 24)
    current.Text = "Currently: " + (data.get("boardColumnName") or "Unassigned")
    theme.style_label(current, muted=True)
    form.Controls.Add(current)

    def make_click(column):
        def handler(sender, args):
            updated = api.move_job(number, column["id"])
            alert("Moved to " + (updated.get("boardColumnName") or column["name"]))
            form.Close()
        return handler

    y = 50
    for column in columns:
        is_current = column.get("id") == data.get("boardColumnId")
        name = column.get("name") or "Column"
        btn = _button(
            name + "  (current)" if is_current else name,
            20, y, 380, 32,
            primary=not is_current,
        )
        btn.Enabled = not is_current
        btn.Click += make_click(column)
        form.Controls.Add(btn)
        y += 40

    form.ShowDialog()


def show_checklist():
    data, number = require_job()

    form = Form()
    form.Text = "Checklist — " + (data.get("jobName") or number)
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(560, 420)
    form.MaximizeBox = False
    theme.style_form(form)

    listbox = ListBox()
    listbox.Location = Point(20, 20)
    listbox.Size = Size(520, 280)
    theme.style_listbox(listbox)
    theme.enable_word_wrap(listbox)

    def refresh(job_data):
        listbox.Items.Clear()
        listbox.Tag = job_data.get("checklist") or []
        for item in listbox.Tag:
            mark = "[x] " if item.get("isComplete") else "[ ] "
            listbox.Items.Add(mark + (item.get("text") or ""))

    refresh(data)

    hint = Label()
    hint.Location = Point(20, 305)
    hint.Size = Size(520, 20)
    hint.Text = "Double-click a row to tick / untick it."
    theme.style_label(hint, muted=True)
    form.Controls.Add(hint)

    add_box = _textbox(20, 330, 400)
    form.Controls.Add(add_box)

    def on_toggle(sender, args):
        items = listbox.Tag or []
        index = listbox.SelectedIndex
        if index < 0 or index >= len(items):
            return
        item = items[index]
        updated = api.toggle_checklist(number, item["id"], not item.get("isComplete"))
        refresh(updated)

    def on_add(sender, args):
        text = add_box.Text.strip()
        if not text:
            return
        updated = api.add_checklist(number, text)
        add_box.Text = ""
        refresh(updated)

    add_btn = _button("Add item", 430, 328, 110, 28, primary=True)
    add_btn.Click += on_add

    listbox.DoubleClick += on_toggle
    form.Controls.Add(listbox)
    form.Controls.Add(add_btn)

    close_btn = _button("Close", 450, 372, 90, 30)
    close_btn.DialogResult = DialogResult.Cancel
    form.Controls.Add(close_btn)
    form.AcceptButton = add_btn
    form.ShowDialog()


def show_new_note():
    data, number = require_job()
    meta = api.meta()
    shot = {"b64": None}

    form = Form()
    form.Text = "New information — " + (data.get("jobName") or number)
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(640, 560)
    form.MaximizeBox = False
    theme.style_form(form)

    form.Controls.Add(_label("Content type", 20, 18, 200))
    type_box = _combo(20, 38, 200, meta.get("contentTypes"), "Screenshot", blank=False)
    form.Controls.Add(type_box)

    form.Controls.Add(_label("Status", 250, 18, 200))
    status_box = _combo(250, 38, 180, meta.get("statuses"), "Action Required")
    if "Action Required" in [str(i) for i in (meta.get("statuses") or [])]:
        status_box.SelectedItem = "Action Required"
    form.Controls.Add(status_box)

    form.Controls.Add(_label("Notes", 20, 74, 200))
    notes = _textbox(20, 94, 600, 110, multiline=True)
    form.Controls.Add(notes)

    form.Controls.Add(_label("Source", 20, 216, 200))
    source_box = _combo(20, 236, 200, meta.get("sources"), "Revit")
    if "Revit" in [str(i) for i in (meta.get("sources") or [])]:
        source_box.SelectedItem = "Revit"
    form.Controls.Add(source_box)

    form.Controls.Add(_label("Topic", 250, 216, 200))
    topic_box = _combo(250, 236, 180, meta.get("topics"))
    form.Controls.Add(topic_box)

    form.Controls.Add(_label("Engineer / person", 20, 272, 200))
    person = _textbox(20, 292, 200)
    form.Controls.Add(person)

    form.Controls.Add(_label("Link (Outlook / Teams URL)", 250, 272, 280))
    link = _textbox(250, 292, 370)
    form.Controls.Add(link)

    shot_label = Label()
    shot_label.Location = Point(20, 340)
    shot_label.Size = Size(600, 24)
    shot_label.Text = "No screenshot yet."
    theme.style_label(shot_label, muted=True)
    form.Controls.Add(shot_label)

    capture_btn = _button("Create screenshot (click and drag)", 20, 368, 260, 32)

    capture_btn.Click += _attach_screenshot(form, shot, shot_label)
    form.Controls.Add(capture_btn)

    view_name = job.current_view_name()
    view_lbl = Label()
    view_lbl.Location = Point(20, 412)
    view_lbl.Size = Size(600, 24)
    view_lbl.Text = "Active view: " + (view_name or "—")
    theme.style_label(view_lbl, muted=True)
    form.Controls.Add(view_lbl)

    def on_save(sender, args):
        payload = {
            "contentType": _combo_value(type_box),
            "status": _combo_value(status_box),
            "textContent": notes.Text,
            "source": _combo_value(source_box),
            "topic": _combo_value(topic_box),
            "person": person.Text,
            "linkUrl": link.Text,
            "viewName": view_name,
        }
        if shot["b64"]:
            payload["screenshotBase64"] = shot["b64"]
            payload["screenshotFileName"] = number + "-revit-capture.png"
            payload["contentType"] = "Screenshot"
        try:
            api.add_entry(number, payload)
            alert("Saved to the information feed.")
            form.Close()
        except Exception as exc:
            alert(str(exc))

    save_btn = _button("Add entry", 410, 500, 100, 32, primary=True)
    save_btn.Click += on_save

    cancel_btn = _button("Cancel", 520, 500, 100, 32)
    cancel_btn.DialogResult = DialogResult.Cancel

    form.Controls.Add(save_btn)
    form.Controls.Add(cancel_btn)
    form.ShowDialog()


def show_add_family():
    data, number = require_job()
    meta = api.meta()
    shot = {"b64": None}
    selected_name = job.selected_family_name()
    revit_ver = job.current_revit_version()

    form = Form()
    form.Text = "Add family — " + (data.get("jobName") or number)
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(640, 620)
    form.MaximizeBox = False
    theme.style_form(form)

    form.Controls.Add(_label("Family name", 20, 18, 280))
    name_box = _textbox(20, 38, 300)
    name_box.Text = selected_name
    form.Controls.Add(name_box)

    form.Controls.Add(_label("Category", 340, 18, 280))
    category_box = _combo(
        340, 38, 280, meta.get("familyCategories"), "Other", blank=False
    )
    form.Controls.Add(category_box)

    link_box = _checkbox(
        "Link to this job — shows on the information feed under Project specific families",
        20, 74, 600, True,
    )
    form.Controls.Add(link_box)

    form.Controls.Add(_label(".rfa network path", 20, 108, 400))
    path_box = _textbox(20, 128, 600)
    form.Controls.Add(path_box)
    path_hint = Label()
    path_hint.Location = Point(20, 154)
    path_hint.Size = Size(600, 32)
    path_hint.Text = (
        "Don't upload the .rfa — paste the path from the job Families folder "
        "so others can copy it in File Explorer."
    )
    theme.style_label(path_hint, muted=True)
    form.Controls.Add(path_hint)

    form.Controls.Add(_label("Description", 20, 192, 200))
    desc_box = _textbox(20, 212, 600, 80, multiline=True)
    form.Controls.Add(desc_box)

    form.Controls.Add(_label("Materials (comma separated)", 20, 302, 280))
    materials_box = _textbox(20, 322, 300)
    form.Controls.Add(materials_box)

    form.Controls.Add(_label("Keywords (comma separated)", 340, 302, 280))
    keywords_box = _textbox(340, 322, 280)
    form.Controls.Add(keywords_box)

    form.Controls.Add(_label("Revit version", 20, 358, 200))
    version_box = _combo(
        20, 378, 200, meta.get("revitVersions"), revit_ver or "2024", blank=False
    )
    form.Controls.Add(version_box)

    shot_label = Label()
    shot_label.Location = Point(20, 418)
    shot_label.Size = Size(600, 24)
    shot_label.Text = "No screenshot yet."
    theme.style_label(shot_label, muted=True)
    form.Controls.Add(shot_label)

    capture_btn = _button("Create screenshot (click and drag)", 20, 446, 260, 32)
    capture_btn.Click += _attach_screenshot(form, shot, shot_label)
    form.Controls.Add(capture_btn)

    def on_save(sender, args):
        payload = {
            "name": name_box.Text,
            "category": _combo_value(category_box),
            "linkToJob": bool(link_box.Checked),
            "filePath": path_box.Text,
            "description": desc_box.Text,
            "materials": materials_box.Text,
            "keywords": keywords_box.Text,
            "revitVersion": _combo_value(version_box),
        }
        if shot["b64"]:
            payload["screenshotBase64"] = shot["b64"]
            payload["screenshotFileName"] = number + "-family.png"
        try:
            api.add_family(number, payload)
            alert("Family added to Tech Hub.")
            form.Close()
        except Exception as exc:
            alert(str(exc))

    save_btn = _button("Add family", 390, 560, 110, 32, primary=True)
    save_btn.Click += on_save
    cancel_btn = _button("Cancel", 510, 560, 110, 32)
    cancel_btn.DialogResult = DialogResult.Cancel
    form.Controls.Add(save_btn)
    form.Controls.Add(cancel_btn)
    form.ShowDialog()


def show_add_detail():
    data, number = require_job()
    meta = api.meta()
    shot = {"b64": None}

    form = Form()
    form.Text = "Add detail — " + (data.get("jobName") or number)
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(640, 620)
    form.MaximizeBox = False
    theme.style_form(form)

    form.Controls.Add(_label("Detail name", 20, 18, 280))
    name_box = _textbox(20, 38, 300)
    form.Controls.Add(name_box)

    form.Controls.Add(_label("Category", 340, 18, 280))
    category_box = _combo(
        340, 38, 280, meta.get("detailCategories"), "Other", blank=False
    )
    form.Controls.Add(category_box)

    link_box = _checkbox(
        "Link to this job — shows on the information feed under Typical details",
        20, 74, 600, True,
    )
    form.Controls.Add(link_box)

    form.Controls.Add(_label("File network path", 20, 108, 400))
    path_box = _textbox(20, 128, 600)
    form.Controls.Add(path_box)
    path_hint = Label()
    path_hint.Location = Point(20, 154)
    path_hint.Size = Size(600, 32)
    path_hint.Text = (
        "Don't upload the CAD/PDF — paste the path from the job folder "
        "so others can copy it in File Explorer."
    )
    theme.style_label(path_hint, muted=True)
    form.Controls.Add(path_hint)

    form.Controls.Add(_label("Description", 20, 192, 200))
    desc_box = _textbox(20, 212, 600, 80, multiline=True)
    form.Controls.Add(desc_box)

    form.Controls.Add(_label("Materials (comma separated)", 20, 302, 280))
    materials_box = _textbox(20, 322, 300)
    form.Controls.Add(materials_box)

    form.Controls.Add(_label("Keywords (comma separated)", 340, 302, 280))
    keywords_box = _textbox(340, 322, 280)
    form.Controls.Add(keywords_box)

    form.Controls.Add(_label("Drawn in", 20, 358, 200))
    drawn_box = _combo(
        20, 378, 200, meta.get("architectSoftwares"), "Revit", blank=False
    )
    form.Controls.Add(drawn_box)

    shot_label = Label()
    shot_label.Location = Point(20, 418)
    shot_label.Size = Size(600, 24)
    shot_label.Text = "No screenshot yet."
    theme.style_label(shot_label, muted=True)
    form.Controls.Add(shot_label)

    capture_btn = _button("Create screenshot (click and drag)", 20, 446, 260, 32)
    capture_btn.Click += _attach_screenshot(form, shot, shot_label)
    form.Controls.Add(capture_btn)

    def on_save(sender, args):
        payload = {
            "name": name_box.Text,
            "category": _combo_value(category_box),
            "linkToJob": bool(link_box.Checked),
            "filePath": path_box.Text,
            "description": desc_box.Text,
            "materials": materials_box.Text,
            "keywords": keywords_box.Text,
            "drawnIn": _combo_value(drawn_box),
        }
        if shot["b64"]:
            payload["screenshotBase64"] = shot["b64"]
            payload["screenshotFileName"] = number + "-detail.png"
        try:
            api.add_detail(number, payload)
            alert("Detail added to Tech Hub.")
            form.Close()
        except Exception as exc:
            alert(str(exc))

    save_btn = _button("Add detail", 390, 560, 110, 32, primary=True)
    save_btn.Click += on_save
    cancel_btn = _button("Cancel", 510, 560, 110, 32)
    cancel_btn.DialogResult = DialogResult.Cancel
    form.Controls.Add(save_btn)
    form.Controls.Add(cancel_btn)
    form.ShowDialog()
