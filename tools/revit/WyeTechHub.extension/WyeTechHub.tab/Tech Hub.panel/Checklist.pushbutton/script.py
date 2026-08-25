from Autodesk.Revit.UI import TaskDialog

try:
    from wyetechhub.run import run
    run("show_checklist")
except Exception:
    import traceback
    TaskDialog.Show("Tech Hub", traceback.format_exc()[-1200:])
