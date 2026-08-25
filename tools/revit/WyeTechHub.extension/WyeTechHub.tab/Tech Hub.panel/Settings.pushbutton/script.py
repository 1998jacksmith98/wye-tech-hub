# IronPython — do not use "#! python3" (CPython/PythonNet breaks WinForms in this pyRevit setup)
from Autodesk.Revit.UI import TaskDialog

try:
    from wyetechhub import ui
    ui.show_settings()
except Exception:
    import traceback
    TaskDialog.Show("Tech Hub Settings v0.3", traceback.format_exc()[-1200:])
