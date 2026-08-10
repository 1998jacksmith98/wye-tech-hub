"""
WYE Tech Hub - Database Layer
SQLite database for shared network drive storage.
"""

import sqlite3
import os
import json
from datetime import datetime


def get_db_path():
    """Returns path to database. On shared drive, set WYE_DB_PATH env var."""
    env_path = os.environ.get("WYE_DB_PATH")
    if env_path:
        return env_path
    # Default: same directory as the script (set this to your network drive path)
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "data", "wye_tech_hub.db")


def get_connection():
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # Better for concurrent access
    return conn


def init_database():
    conn = get_connection()
    c = conn.cursor()

    # Jobs table
    c.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_number TEXT NOT NULL,
            job_name TEXT NOT NULL,
            status TEXT DEFAULT 'Active',
            lead_technician TEXT,
            lead_engineer TEXT,
            client TEXT,
            architect TEXT,
            architect_software TEXT,
            revit_version TEXT,
            start_date TEXT,
            next_issue_date TEXT,
            assigned_users TEXT DEFAULT '[]',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    # Migrate existing DB — add columns if they don't exist yet
    existing = [r[1] for r in c.execute("PRAGMA table_info(jobs)").fetchall()]
    if "next_issue_date" not in existing:
        c.execute("ALTER TABLE jobs ADD COLUMN next_issue_date TEXT")
    if "assigned_users" not in existing:
        c.execute("ALTER TABLE jobs ADD COLUMN assigned_users TEXT DEFAULT '[]'")

    # Milestones / Timeline
    c.execute("""
        CREATE TABLE IF NOT EXISTS milestones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            stage TEXT NOT NULL,
            target_date TEXT,
            confirmed_date TEXT,
            is_reached INTEGER DEFAULT 0,
            notes TEXT,
            updated_by TEXT,
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    """)

    # Checklist items
    c.execute("""
        CREATE TABLE IF NOT EXISTS checklist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            assigned_to TEXT,
            is_complete INTEGER DEFAULT 0,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            completed_by TEXT,
            completed_at TEXT,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    """)

    # Information entries (notes, uploads, screenshots etc.)
    c.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            content_type TEXT DEFAULT 'note',
            text_content TEXT,
            file_path TEXT,
            file_name TEXT,
            link_url TEXT,
            tags_json TEXT DEFAULT '{}',
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    """)

    # Migrate existing entries table
    entry_cols = [r[1] for r in c.execute("PRAGMA table_info(entries)").fetchall()]
    if "link_url" not in entry_cols:
        c.execute("ALTER TABLE entries ADD COLUMN link_url TEXT")

    # Activity feed
    c.execute("""
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER,
            job_name TEXT,
            action TEXT,
            detail TEXT,
            user TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()


# ── Jobs ──────────────────────────────────────────────────────────────────────

def create_job(data: dict, user: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO jobs (job_number, job_name, status, lead_technician, lead_engineer,
            client, architect, architect_software, revit_version, start_date,
            next_issue_date, assigned_users, created_by)
        VALUES (:job_number, :job_name, :status, :lead_technician, :lead_engineer,
            :client, :architect, :architect_software, :revit_version, :start_date,
            :next_issue_date, :assigned_users, :created_by)
    """, {**data, "created_by": user,
          "next_issue_date": data.get("next_issue_date", ""),
          "assigned_users": data.get("assigned_users", "[]")})
    job_id = c.lastrowid
    for stage in ["S3 Issue", "S4 Issue", "S5 Issue", "Complete"]:
        c.execute("INSERT INTO milestones (job_id, stage) VALUES (?, ?)", (job_id, stage))
    log_activity(conn, job_id, data["job_name"], "created job", data["job_name"], user)
    conn.commit()
    conn.close()
    return job_id


def get_all_jobs():
    conn = get_connection()
    rows = conn.execute("""
        SELECT j.*, 
               (SELECT COUNT(*) FROM checklist_items WHERE job_id=j.id AND is_complete=0) as open_actions
        FROM jobs j ORDER BY j.updated_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_job(job_id: int):
    conn = get_connection()
    row = conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_job(job_id: int, data: dict, user: str):
    conn = get_connection()
    data["updated_at"] = datetime.now().isoformat()
    data["id"] = job_id
    conn.execute("""
        UPDATE jobs SET job_number=:job_number, job_name=:job_name, status=:status,
            lead_technician=:lead_technician, lead_engineer=:lead_engineer, client=:client,
            architect=:architect, architect_software=:architect_software,
            revit_version=:revit_version, start_date=:start_date,
            next_issue_date=:next_issue_date, updated_at=:updated_at
        WHERE id=:id
    """, data)
    log_activity(conn, job_id, data["job_name"], "updated job info", "", user)
    conn.commit()
    conn.close()


def get_assigned_users(job_id: int) -> list:
    conn = get_connection()
    row = conn.execute("SELECT assigned_users FROM jobs WHERE id=?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return []
    try:
        return json.loads(row["assigned_users"] or "[]")
    except Exception:
        return []


def set_assigned_users(job_id: int, users: list, acting_user: str, job_name: str):
    """Replaces the full assigned users list and logs joins/leaves."""
    conn = get_connection()
    row = conn.execute("SELECT assigned_users, job_name FROM jobs WHERE id=?", (job_id,)).fetchone()
    old = []
    name = job_name
    if row:
        try:
            old = json.loads(row["assigned_users"] or "[]")
        except Exception:
            old = []
        name = row["job_name"] or job_name

    joined = [u for u in users if u not in old]
    left   = [u for u in old   if u not in users]

    conn.execute("""
        UPDATE jobs SET assigned_users=?, updated_at=datetime('now') WHERE id=?
    """, (json.dumps(users), job_id))

    for u in joined:
        log_activity(conn, job_id, name, f"joined {name}", "", u)
    for u in left:
        log_activity(conn, job_id, name, f"left {name}", "", u)

    conn.commit()
    conn.close()


# ── Milestones ────────────────────────────────────────────────────────────────

def get_milestones(job_id: int):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM milestones WHERE job_id=? ORDER BY id", (job_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_milestone(milestone_id: int, target_date: str, confirmed_date: str,
                     is_reached: int, notes: str, user: str, job_name: str, job_id: int):
    conn = get_connection()
    conn.execute("""
        UPDATE milestones SET target_date=?, confirmed_date=?, is_reached=?,
            notes=?, updated_by=?, updated_at=datetime('now')
        WHERE id=?
    """, (target_date, confirmed_date, is_reached, notes, user, milestone_id))
    conn.execute("UPDATE jobs SET updated_at=datetime('now') WHERE id=?", (job_id,))
    log_activity(conn, job_id, job_name, "updated timeline", "", user)
    conn.commit()
    conn.close()


# ── Checklist ─────────────────────────────────────────────────────────────────

def get_checklist(job_id: int):
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM checklist_items WHERE job_id=? ORDER BY is_complete ASC, created_at DESC
    """, (job_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_checklist_item(job_id: int, text: str, assigned_to: str, user: str, job_name: str):
    conn = get_connection()
    conn.execute("""
        INSERT INTO checklist_items (job_id, text, assigned_to, created_by)
        VALUES (?, ?, ?, ?)
    """, (job_id, text, assigned_to, user))
    conn.execute("UPDATE jobs SET updated_at=datetime('now') WHERE id=?", (job_id,))
    log_activity(conn, job_id, job_name, "added action item", text[:60], user)
    conn.commit()
    conn.close()


def toggle_checklist_item(item_id: int, is_complete: bool, user: str, job_id: int, job_name: str):
    conn = get_connection()
    completed_at = datetime.now().isoformat() if is_complete else None
    completed_by = user if is_complete else None
    conn.execute("""
        UPDATE checklist_items SET is_complete=?, completed_by=?, completed_at=?
        WHERE id=?
    """, (int(is_complete), completed_by, completed_at, item_id))
    conn.execute("UPDATE jobs SET updated_at=datetime('now') WHERE id=?", (job_id,))
    action = "completed action" if is_complete else "reopened action"
    log_activity(conn, job_id, job_name, action, "", user)
    conn.commit()
    conn.close()


def delete_checklist_item(item_id: int, job_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM checklist_items WHERE id=?", (item_id,))
    conn.commit()
    conn.close()


# ── Entries ───────────────────────────────────────────────────────────────────

def get_entries(job_id: int, filters: dict = None):
    conn = get_connection()
    query = "SELECT * FROM entries WHERE job_id=?"
    params = [job_id]
    rows = conn.execute(query + " ORDER BY created_at DESC", params).fetchall()
    conn.close()
    entries = [dict(r) for r in rows]
    # Parse tags and apply filters client-side for flexibility
    for e in entries:
        try:
            e["tags"] = json.loads(e["tags_json"] or "{}")
        except Exception:
            e["tags"] = {}
    if filters:
        filtered = []
        for e in entries:
            match = True
            for key, val in filters.items():
                if not val:
                    continue
                tag_val = e["tags"].get(key, "")
                if val.lower() not in tag_val.lower():
                    match = False
                    break
            if match:
                filtered.append(e)
        return filtered
    return entries


def add_entry(job_id: int, content_type: str, text_content: str,
              file_path: str, file_name: str, tags: dict, user: str,
              job_name: str, link_url: str = ""):
    conn = get_connection()
    conn.execute("""
        INSERT INTO entries (job_id, content_type, text_content, file_path, file_name, link_url, tags_json, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_id, content_type, text_content, file_path, file_name,
          link_url or "", json.dumps(tags), user))
    conn.execute("UPDATE jobs SET updated_at=datetime('now') WHERE id=?", (job_id,))
    detail = text_content[:60] if text_content else (file_name or "")
    log_activity(conn, job_id, job_name, f"added {content_type}", detail, user)
    conn.commit()
    conn.close()


def delete_entry(entry_id: int, job_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM entries WHERE id=?", (entry_id,))
    conn.commit()
    conn.close()


def get_all_tag_values(job_id: int, tag_key: str):
    """Returns all unique values for a tag key across entries in a job."""
    conn = get_connection()
    rows = conn.execute("SELECT tags_json FROM entries WHERE job_id=?", (job_id,)).fetchall()
    conn.close()
    values = set()
    for r in rows:
        try:
            tags = json.loads(r["tags_json"] or "{}")
            v = tags.get(tag_key, "")
            if v:
                values.add(v)
        except Exception:
            pass
    return sorted(values)


# ── Activity ──────────────────────────────────────────────────────────────────

def log_activity(conn, job_id, job_name, action, detail, user):
    conn.execute("""
        INSERT INTO activity (job_id, job_name, action, detail, user)
        VALUES (?, ?, ?, ?, ?)
    """, (job_id, job_name, action, detail, user))


def get_activity_feed(limit: int = 50):
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM activity ORDER BY created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
