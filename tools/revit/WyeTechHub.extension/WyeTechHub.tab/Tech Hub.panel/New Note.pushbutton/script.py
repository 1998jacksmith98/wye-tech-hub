#! python3
from wyetechhub import ui

try:
    ui.show_new_note()
except Exception as exc:
    ui.alert(exc)
