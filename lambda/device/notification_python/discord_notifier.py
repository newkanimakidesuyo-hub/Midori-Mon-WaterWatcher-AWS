import json
import urllib.error
import urllib.request

from config import DISCORD_WEBHOOK_URL


def send_discord_embed(title, description, color=0x2ECC71):
    payload = {
        "username": "ミドリモン",
        "embeds": [
            {
                "title": title,
                "description": description,
                "color": color,
                "footer": {"text": "Midori-Mon WaterWatcher"},
            }
        ],
    }

    req = urllib.request.Request(
        DISCORD_WEBHOOK_URL + "?wait=true",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as res:
            return res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="ignore")
        print(f"Discord HTTPError: {e.code} {detail}")
        raise
