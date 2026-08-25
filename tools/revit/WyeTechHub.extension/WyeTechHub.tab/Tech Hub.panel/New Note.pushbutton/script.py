from Autodesk.Revit.UI import TaskDialog

try:
    from wyetechhub.run import run
    run("show_new_note")
except Exception:
    import traceback
    TaskDialog.Show("Tech Hub", traceback.format_exc()[-1200:])
