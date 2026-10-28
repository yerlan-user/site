#!/usr/bin/env python3
"""Забирает публичные посты аккаунта аэропорта из Instagram и кладёт их в airport/.

Работает через официальный Instagram Graph API (Business Discovery): посты
другого бизнес-аккаунта читаются от имени вашего бизнес-аккаунта, поэтому
ни читателям сайта, ни скрипту не нужен логин в Instagram.

Переменные окружения:
  IG_USER_ID       — ID вашего бизнес-аккаунта Instagram (обязательно)
  IG_ACCESS_TOKEN  — токен доступа Meta (обязательно)
  IG_TARGET        — имя аккаунта аэропорта без @ (по умолчанию из airport/config.json)
  GRAPH_VERSION    — версия Graph API (по умолчанию v23.0)

Картинки скачиваются в airport/media/, потому что ссылки Instagram CDN
со временем перестают работать.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "airport"
MEDIA_DIR = OUT_DIR / "media"
POSTS_FILE = OUT_DIR / "posts.json"
CONFIG_FILE = OUT_DIR / "config.json"

KEEP_POSTS = 60          # сколько последних постов хранить на сайте
FETCH_LIMIT = 25         # сколько постов запрашивать за один запуск
MAX_IMAGES_PER_POST = 10


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def graph_get(version, ig_user_id, token, target):
    media_fields = (
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,"
        "children{media_type,media_url,thumbnail_url}"
    )
    fields = (
        f"business_discovery.username({target})"
        f"{{username,name,profile_picture_url,media.limit({FETCH_LIMIT}){{{media_fields}}}}}"
    )
    query = urllib.parse.urlencode({"fields": fields, "access_token": token})
    url = f"https://graph.facebook.com/{version}/{ig_user_id}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        sys.exit(f"Graph API вернул {e.code}: {body}")


def download(url, dest):
    if dest.exists():
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"Не удалось скачать {url}: {e}", file=sys.stderr)
        return False
    dest.write_bytes(data)
    return True


def iso_date(ts):
    """2026-10-26T08:00:00+0000 → 2026-10-26T08:00:00+00:00 (так понимают все браузеры)."""
    if len(ts) > 5 and ts[-5] in "+-" and ts[-4:].isdigit():
        return f"{ts[:-2]}:{ts[-2:]}"
    return ts


def image_urls(item):
    """Картинки поста: фото как есть, для видео — обложка."""
    if item.get("media_type") == "CAROUSEL_ALBUM":
        children = item.get("children", {}).get("data", [])
    else:
        children = [item]
    urls = []
    for c in children:
        url = c.get("thumbnail_url") if c.get("media_type") == "VIDEO" else c.get("media_url")
        if url:
            urls.append(url)
    return urls[:MAX_IMAGES_PER_POST]


def main():
    config = load_json(CONFIG_FILE, {})
    target = os.environ.get("IG_TARGET") or config.get("instagram")
    ig_user_id = os.environ.get("IG_USER_ID")
    token = os.environ.get("IG_ACCESS_TOKEN")
    version = os.environ.get("GRAPH_VERSION", "v23.0")
    if not (target and ig_user_id and token):
        sys.exit("Нужны IG_USER_ID, IG_ACCESS_TOKEN и имя аккаунта (IG_TARGET или airport/config.json)")

    bd = graph_get(version, ig_user_id, token, target).get("business_discovery", {})
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    existing = {p["id"]: p for p in load_json(POSTS_FILE, {}).get("posts", [])}
    for item in bd.get("media", {}).get("data", []):
        images = []
        for n, url in enumerate(image_urls(item)):
            name = f"{item['id']}_{n}.jpg"
            if download(url, MEDIA_DIR / name):
                images.append(f"media/{name}")
        if not images and item["id"] in existing:
            images = existing[item["id"]]["images"]
        existing[item["id"]] = {
            "id": item["id"],
            "text": item.get("caption", ""),
            "type": item.get("media_type", ""),
            "images": images,
            "url": item.get("permalink", ""),
            "date": iso_date(item.get("timestamp", "")),
        }

    posts = sorted(existing.values(), key=lambda p: p["date"], reverse=True)[:KEEP_POSTS]

    # Удаляем картинки постов, выпавших из ленты.
    used = {img.split("/", 1)[1] for p in posts for img in p["images"]}
    for f in MEDIA_DIR.glob("*.jpg"):
        if f.name not in used:
            f.unlink()

    POSTS_FILE.write_text(json.dumps({
        "account": {
            "username": bd.get("username", target),
            "name": bd.get("name", ""),
        },
        "posts": posts,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Сохранено постов: {len(posts)}")


if __name__ == "__main__":
    main()
