# -*- coding: utf-8 -*-
import json
from wyetechhub import config

try:
    from System.Net import ServicePointManager, SecurityProtocolType, WebClient, WebException
    from System.Text import Encoding
    from System.IO import StreamReader
    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12
except Exception:
    WebClient = None
    WebException = Exception
    Encoding = None
    StreamReader = None


class ApiError(Exception):
    def __init__(self, message, status=None):
        Exception.__init__(self, message)
        self.status = status


def _client():
    cfg = config.load()
    if not cfg.get("hubUrl") or not cfg.get("token"):
        raise ApiError("Connect Tech Hub in Settings first (URL + token).")
    if WebClient is None:
        raise ApiError("This Revit Python engine cannot make HTTP requests.")
    client = WebClient()
    client.Encoding = Encoding.UTF8
    client.Headers.Add("Authorization", "Bearer " + cfg["token"])
    client.Headers.Add("Accept", "application/json")
    return client, cfg["hubUrl"]


def _parse_error(exc):
    try:
        response = exc.Response
        if response is None:
            return str(exc)
        stream = response.GetResponseStream()
        text = StreamReader(stream).ReadToEnd()
        data = json.loads(text)
        return data.get("error") or text
    except Exception:
        return str(exc)


def _request(method, path, payload=None):
    client, base = _client()
    url = base + path
    try:
        if method == "GET":
            raw = client.DownloadString(url)
        else:
            client.Headers.Add("Content-Type", "application/json")
            body = json.dumps(payload or {})
            raw = client.UploadString(url, method, body)
        return json.loads(raw) if raw else {}
    except WebException as exc:
        raise ApiError(_parse_error(exc))
    finally:
        client.Dispose()


def me():
    return _request("GET", "/api/revit/me")


def meta():
    return _request("GET", "/api/revit/meta")


def get_job(job_number):
    return _request("GET", "/api/revit/jobs/" + job_number).get("job")


def move_job(job_number, column_id):
    return _request(
        "POST",
        "/api/revit/jobs/" + job_number + "/move",
        {"columnId": column_id},
    ).get("job")


def add_checklist(job_number, text):
    return _request(
        "POST",
        "/api/revit/jobs/" + job_number + "/checklist",
        {"text": text},
    ).get("job")


def toggle_checklist(job_number, item_id, is_complete):
    return _request(
        "POST",
        "/api/revit/jobs/" + job_number + "/checklist/" + item_id,
        {"isComplete": bool(is_complete)},
    ).get("job")


def add_entry(job_number, payload):
    return _request(
        "POST",
        "/api/revit/jobs/" + job_number + "/entries",
        payload,
    ).get("job")
