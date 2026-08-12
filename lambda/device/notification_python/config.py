import os

# Environment variables
DISCORD_WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
THING_NAME = os.environ.get("THING_NAME", "Midori-Mon-WaterWatcher")

# DynamoDB
DYNAMODB_MOISTURE_TABLE_NAME = os.environ.get(
    "DYNAMODB_MOISTURE_TABLE_NAME",
    "Midori-Mon-WaterWatcher-DB-MoistureSensor",
)
DYNAMODB_BATTERY_TABLE_NAME = os.environ.get(
    "DYNAMODB_BATTERY_TABLE_NAME",
    "Midori-Mon-WaterWatcher-DB-DeviceBattery",
)
DYNAMODB_TEMPERATURE_TABLE_NAME = os.environ.get(
    "DYNAMODB_TEMPERATURE_TABLE_NAME",
    "Midori-Mon-WaterWatcher-DB-TemperatureSensor",
)

# Thresholds
LOW_THRESHOLD = 30
RECOVERY_THRESHOLD = 60

# Message templates
LOW_MESSAGES = [
    "💧 みどりモンだよ！のどカラカラ… お水ちょうだい〜！",
    "🌱 ピンチ！土がかわいてるよ。ひとくち給水お願いっ！",
    "🪴 しょんぼり中… 水分が足りないみたい！助けて〜！",
]

RECOVERY_MESSAGES = [
    "✨ みどりモン復活！お水ありがとう〜！",
    "🌈 うるおいチャージ完了！元気になったよ！",
    "🍀 回復したよ！この調子で見守ってね！",
]
