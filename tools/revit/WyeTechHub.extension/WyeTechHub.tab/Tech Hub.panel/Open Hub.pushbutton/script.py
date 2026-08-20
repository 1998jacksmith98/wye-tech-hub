#! python3
from wyetechhub import ui

try:
    data, _number = ui.require_job()
    ui.open_url(data.get("hubUrl"))
except Exception as exc:
    ui.alert(exc)
