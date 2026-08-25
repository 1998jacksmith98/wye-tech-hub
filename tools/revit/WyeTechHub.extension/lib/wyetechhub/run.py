# -*- coding: utf-8 -*-
from __future__ import print_function
import os
import traceback

from wyetechhub import config


def _show_error(err):
    text = str(err)
    try:
        if not os.path.isdir(config.APP_DIR):
            os.makedirs(config.APP_DIR)
        path = os.path.join(config.APP_DIR, "last-error.txt")
        with open(path, "w") as handle:
            handle.write(text)
    except Exception:
        path = ""

    summary = text[-900:]
    if path:
        summary = summary + "\n\nFull error saved to:\n" + path
    try:
        from Autodesk.Revit.UI import TaskDialog
        TaskDialog.Show("Tech Hub", summary)
    except Exception:
        print(text)


def run(action_name):
    try:
        from wyetechhub import ui
        getattr(ui, action_name)()
    except Exception:
        _show_error(traceback.format_exc())
