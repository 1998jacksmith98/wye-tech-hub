from Autodesk.Revit.UI import TaskDialog

try:
    from wyetechhub.run import run
    run("show_this_job")
except Exception:
    import traceback
    TaskDialog.Show("Tech Hub", traceback.format_exc()[-1200:])
