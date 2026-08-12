import json
import random

from config import (
    LOW_MESSAGES,
    LOW_THRESHOLD,
    RECOVERY_MESSAGES,
    RECOVERY_THRESHOLD,
    THING_NAME,
)
from discord_notifier import send_discord_embed
from db_writer import write_battery_data, write_moisture_data, write_temperature_data
from event_parser import extract_battery, extract_moisture, extract_moisture_result, extract_temperature
from iot_shadow import get_alerted_flag, update_shadow_alerted


def _battery_line(battery):
    """Format battery info as a string to append to notification text."""
    if not battery or battery.get("battery_pct") is None:
        return ""
    pct = battery["battery_pct"]
    mv = battery.get("battery_mv")
    charging = battery.get("is_charging")
    parts = [f"\nバッテリー: **{pct}%**"]
    if mv is not None:
        parts.append(f"({mv} mV)")
    if charging:
        parts.append("⚡ 充電中")
    return " ".join(parts)


def lambda_handler(event, context):
    print(f"Received event: {json.dumps(event, ensure_ascii=False)}")

    moisture = extract_moisture(event)
    moisture_result = extract_moisture_result(event)
    battery = extract_battery(event)
    temperature = extract_temperature(event)
    thing_name = event.get("thing_name", THING_NAME)
    already_alerted = get_alerted_flag(thing_name)

    print(
        f"Parsed: moisture={moisture}, moisture_result={moisture_result}, "
        f"battery={battery}, temperature={temperature}, alerted={already_alerted}, thing_name={thing_name}"
    )

    # 受信データを問わず毎回DynamoDBに記録
    write_moisture_data(thing_name, moisture, moisture_result, already_alerted)
    write_battery_data(thing_name, battery)
    write_temperature_data(thing_name, temperature)

    if moisture is None:
        print("Moisture not found. Skip.")
        return {"statusCode": 200, "body": "skipped: no moisture"}

    print(f"Check: moisture={moisture}, alerted={already_alerted}")

    battery_line = _battery_line(battery)

    if moisture <= LOW_THRESHOLD and not already_alerted:
        text = f"**{thing_name}**\n{random.choice(LOW_MESSAGES)}\n現在の水分: **{moisture}%**{battery_line}"
        send_discord_embed(
            title="🚨 水分不足アラート",
            description=text,
            color=0xFF6B6B,
        )
        update_shadow_alerted(thing_name, True)
        return {"statusCode": 200, "body": "low alert sent"}

    if moisture >= RECOVERY_THRESHOLD and already_alerted:
        text = f"**{thing_name}**\n{random.choice(RECOVERY_MESSAGES)}\n現在の水分: **{moisture}%**{battery_line}"
        send_discord_embed(
            title="✅ 回復通知",
            description=text,
            color=0x4ECDC4,  # 緑青系
        )
        update_shadow_alerted(thing_name, False)
        return {"statusCode": 200, "body": "recovery sent"}

    print("No action taken.")
    return {"statusCode": 200, "body": "no action"}