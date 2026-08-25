# -*- coding: utf-8 -*-
import os
import re

JOB_RE = re.compile(r"(J\d{3,6})", re.IGNORECASE)


def _from_text(text):
    if not text:
        return ""
    match = JOB_RE.search(text)
    return match.group(1).upper() if match else ""


def current_view_name():
    try:
        from pyrevit import revit
        view = revit.doc.ActiveView
        return view.Name if view else ""
    except Exception:
        return ""


def current_job_number():
    try:
        from pyrevit import revit
        doc = revit.doc
    except Exception:
        return ""

    try:
        from Autodesk.Revit.DB import BuiltInParameter
        param = doc.ProjectInformation.get_Parameter(BuiltInParameter.PROJECT_NUMBER)
        if param:
            found = _from_text(param.AsString())
            if found:
                return found
    except Exception:
        pass

    for source in (getattr(doc, "PathName", None), getattr(doc, "Title", None)):
        found = _from_text(os.path.basename(source or ""))
        if found:
            return found
    return ""


def current_revit_version():
    try:
        from pyrevit import HOST_APP
        raw = str(getattr(HOST_APP, "version", "") or "")
        match = re.search(r"(20\d{2})", raw)
        return match.group(1) if match else raw[:4]
    except Exception:
        return ""


def selected_family_name():
    try:
        from pyrevit import revit
        from Autodesk.Revit.DB import FamilyInstance, FamilySymbol
        ids = list(revit.uidoc.Selection.GetElementIds())
        if not ids:
            return ""
        el = revit.doc.GetElement(ids[0])
        if isinstance(el, FamilyInstance) and el.Symbol and el.Symbol.Family:
            return el.Symbol.Family.Name or ""
        if isinstance(el, FamilySymbol) and el.Family:
            return el.Family.Name or ""
    except Exception:
        pass
    return ""
