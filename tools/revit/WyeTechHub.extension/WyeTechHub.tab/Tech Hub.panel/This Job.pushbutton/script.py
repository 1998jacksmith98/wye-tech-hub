#! python3
from wyetechhub import ui

try:
    ui.show_this_job()
except Exception as exc:
    ui.alert(exc)
