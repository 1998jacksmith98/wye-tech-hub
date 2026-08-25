# -*- coding: utf-8 -*-
import json
import os

APP_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "WyeTechHub")
CONFIG_PATH = os.path.join(APP_DIR, "revit.json")


def normalize_hub_url(url):
    text = (url or "").strip()
    while text.endswith("/"):
        text = text[:-1]
    lower = text.lower()
    for suffix in ("/app/revit", "/app"):
        if lower.endswith(suffix):
            text = text[: len(text) - len(suffix)]
            break
    while text.endswith("/"):
        text = text[:-1]
    return text


def load():
    if not os.path.isfile(CONFIG_PATH):
        return {"hubUrl": "", "token": ""}
    try:
        with open(CONFIG_PATH, "r") as handle:
            data = json.load(handle)
        return {
            "hubUrl": normalize_hub_url(data.get("hubUrl") or ""),
            "token": (data.get("token") or "").strip(),
        }
    except Exception:
        return {"hubUrl": "", "token": ""}


def save(hub_url, token):
    if not os.path.isdir(APP_DIR):
        os.makedirs(APP_DIR)
    payload = {
        "hubUrl": normalize_hub_url(hub_url),
        "token": (token or "").strip(),
    }
    with open(CONFIG_PATH, "w") as handle:
        json.dump(payload, handle, indent=2)
    return payload


def is_ready():
    data = load()
    return bool(data.get("hubUrl") and data.get("token"))
