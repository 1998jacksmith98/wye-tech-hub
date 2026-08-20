#! python3
from wyetechhub import ui

try:
    ui.show_move_stage()
except Exception as exc:
    ui.alert(exc)
