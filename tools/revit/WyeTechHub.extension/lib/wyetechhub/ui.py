# -*- coding: utf-8 -*-
from System.Diagnostics import Process, ProcessStartInfo
from System.Drawing import Font, FontStyle, Point, Size
from System.Windows.Forms import (
    Button,
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

from wyetechhub import api, config, job, screenshot

try:
    from pyrevit import forms
except Exception:
    forms = None


def alert(message, title="Tech Hub"):
    if forms:
        forms.alert(str(message), title=title, warn_icon=False)
    else:
        from System.Windows.Forms import MessageBox
        MessageBox.Show(str(message), title)


def open_url(url):
    info = ProcessStartInfo()
    info.FileName = url
    info.UseShellExecute = True
    Process.Start(info)


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


def _label(text, x, y, w=120, bold=False):
    lbl = Label()
    lbl.Text = text
    lbl.Location = Point(x, y)
    lbl.Size = Size(w, 20)
    if bold:
        lbl.Font = Font(lbl.Font, FontStyle.Bold)
    return lbl


def _textbox(x, y, w, h=24, multiline=False):
    box = TextBox()
    box.Location = Point(x, y)
    box.Size = Size(w, h)
    box.Multiline = multiline
    if multiline:
        box.AcceptsReturn = True
        box.ScrollBars = ScrollBars.Vertical
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
    return combo


def _combo_value(combo):
    value = combo.SelectedItem
    return str(value) if value is not None else "—"


def show_settings():
    current = config.load()
    form = Form()
    form.Text = "Tech Hub — Settings"
    form.StartPosition = FormStartPosition.CenterScreen
    form.ClientSize = Size(520, 210)
    form.FormBorderStyle = FormBorderStyle.FixedDialog
    form.MaximizeBox = False

    form.Controls.Add(_label("Tech Hub website URL", 20, 18, 400))
    url_box = _textbox(20, 40, 480)
    url_box.Text = current.get("hubUrl") or "http://localhost:3000"
    form.Controls.Add(url_box)

    form.Controls.Add(_label("Revit token (from Tech Hub → Revit)", 20, 78, 400))
    token_box = _textbox(20, 100, 480)
    token_box.Text = current.get("token") or ""
    form.Controls.Add(token_box)

    save_btn = Button()
    save_btn.Text = "Save"
    save_btn.Location = Point(310, 150)
    save_btn.Size = Size(90, 30)

    cancel_btn = Button()
    cancel_btn.Text = "Cancel"
    cancel_btn.Location = Point(410, 150)
    cancel_btn.Size = Size(90, 30)
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
    form.ClientSize = Size(520, 280)
    form.MaximizeBox = False

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
    info.Size = Size(480, 140)
    info.Text = "\n".join(lines)
    form.Controls.Add(info)

    def add_btn(text, x, click):
        btn = Button()
        btn.Text = text
        btn.Location = Point(x, 180)
        btn.Size = Size(110, 32)
        btn.Click += click
        form.Controls.Add(btn)
        return btn

    add_btn("Move stage", 20, lambda s, a: (form.Close(), show_move_stage()))
    add_btn("Checklist", 140, lambda s, a: (form.Close(), show_checklist()))
    add_btn("New note", 260, lambda s, a: (form.Close(), show_new_note()))
    add_btn("Open hub", 380, lambda s, a: open_url(data.get("hubUrl")))

    close_btn = Button()
    close_btn.Text = "Close"
    close_btn.Location = Point(400, 230)
    close_btn.Size = Size(90, 30)
    close_btn.DialogResult = DialogResult.Cancel
    form.Controls.Add(close_btn)
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

    current = Label()
    current.Location = Point(20, 15)
    current.Size = Size(380, 24)
    current.Text = "Currently: " + (data.get("boardColumnName") or "Unassigned")
    form.Controls.Add(current)

    def make_click(column):
        def handler(sender, args):
            updated = api.move_job(number, column["id"])
            alert("Moved to " + (updated.get("boardColumnName") or column["name"]))
            form.Close()
        return handler

    y = 50
    for column in columns:
        btn = Button()
        name = column.get("name") or "Column"
        if column.get("id") == data.get("boardColumnId"):
            btn.Text = name + "  (current)"
        else:
            btn.Text = name
        btn.Location = Point(20, y)
        btn.Size = Size(380, 32)
        btn.Enabled = column.get("id") != data.get("boardColumnId")
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

    listbox = ListBox()
    listbox.Location = Point(20, 20)
    listbox.Size = Size(520, 280)

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

    add_btn = Button()
    add_btn.Text = "Add item"
    add_btn.Location = Point(430, 328)
    add_btn.Size = Size(110, 28)
    add_btn.Click += on_add

    listbox.DoubleClick += on_toggle
    form.Controls.Add(listbox)
    form.Controls.Add(add_btn)

    close_btn = Button()
    close_btn.Text = "Close"
    close_btn.Location = Point(450, 372)
    close_btn.Size = Size(90, 30)
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
    form.Controls.Add(shot_label)

    capture_btn = Button()
    capture_btn.Text = "Create screenshot (click and drag)"
    capture_btn.Location = Point(20, 368)
    capture_btn.Size = Size(260, 32)

    def on_capture(sender, args):
        form.Hide()
        try:
            b64 = screenshot.capture_region_png_base64()
        finally:
            form.Show()
            form.Activate()
        if b64:
            shot["b64"] = b64
            shot_label.Text = "Screenshot attached — it will upload with this note."
        else:
            shot_label.Text = "Screenshot cancelled."

    capture_btn.Click += on_capture
    form.Controls.Add(capture_btn)

    view_name = job.current_view_name()
    view_lbl = Label()
    view_lbl.Location = Point(20, 412)
    view_lbl.Size = Size(600, 24)
    view_lbl.Text = "Active view: " + (view_name or "—")
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

    save_btn = Button()
    save_btn.Text = "Add entry"
    save_btn.Location = Point(410, 500)
    save_btn.Size = Size(100, 32)
    save_btn.Click += on_save

    cancel_btn = Button()
    cancel_btn.Text = "Cancel"
    cancel_btn.Location = Point(520, 500)
    cancel_btn.Size = Size(100, 32)
    cancel_btn.DialogResult = DialogResult.Cancel

    form.Controls.Add(save_btn)
    form.Controls.Add(cancel_btn)
    form.ShowDialog()
