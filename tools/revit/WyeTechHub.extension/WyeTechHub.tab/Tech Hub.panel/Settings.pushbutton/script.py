#! python3
from wyetechhub import ui

try:
    ui.show_settings()
except Exception as exc:
    ui.alert(exc)
