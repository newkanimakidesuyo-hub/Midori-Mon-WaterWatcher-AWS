import json

import boto3

client = boto3.client("iot-data")


def get_alerted_flag(thing_name):
    try:
        response = client.get_thing_shadow(thingName=thing_name)
        payload = json.loads(response["payload"].read())
        return payload.get("state", {}).get("reported", {}).get("alerted", False)
    except Exception as e:
        print(f"Shadow get error: {e}")
        return False


def update_shadow_alerted(thing_name, status):
    payload = {"state": {"reported": {"alerted": status}}}
    client.update_thing_shadow(
        thingName=thing_name,
        payload=json.dumps(payload).encode("utf-8"),
    )
