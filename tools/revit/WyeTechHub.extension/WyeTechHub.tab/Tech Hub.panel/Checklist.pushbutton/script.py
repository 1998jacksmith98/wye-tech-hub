#! python3
from wyetechhub import ui

try:
    ui.show_checklist()
except Exception as exc:
    ui.alert(exc)
