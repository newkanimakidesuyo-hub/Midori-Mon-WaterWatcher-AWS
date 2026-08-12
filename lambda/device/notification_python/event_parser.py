def to_int(value):
    try:
        return int(float(value))
    except Exception:
        return None


def _get_reported(event):
    """Return the state.reported dict from an IoT Shadow event."""
    return (event or {}).get("state", {}).get("reported", {})


def extract_moisture(event):
    reported = _get_reported(event)

    # New shape: state.reported.moisture_sensor_unit.moisture
    unit = reported.get("moisture_sensor_unit", {})
    if unit.get("moisture") is not None:
        return to_int(unit["moisture"])

    # Legacy flat shape: state.reported.moisture
    if reported.get("moisture") is not None:
        return to_int(reported["moisture"])

    # IoT Rule SQL flat event: { "moisture": 58 }
    if isinstance(event, dict) and event.get("moisture") is not None:
        return to_int(event["moisture"])

    return None


def extract_moisture_result(event):
    """Return moisture_sensor_unit.result (bool), or None if absent."""
    unit = _get_reported(event).get("moisture_sensor_unit", {})
    result = unit.get("result")
    return bool(result) if result is not None else None


def extract_temperature(event):
    """Return temperature_sensor fields as a dict, or None if the group is absent.

    Keys: temperature_c (float), result (bool)
    """
    temp = _get_reported(event).get("temperature_sensor")
    if not isinstance(temp, dict):
        return None

    temperature_c = temp.get("temperature_c")
    result = temp.get("result")
    return {
        "temperature_c": float(temperature_c) if temperature_c is not None else None,
        "result": bool(result) if result is not None else None,
    }


def extract_battery(event):
    """Return battery fields as a dict, or None if the battery group is absent.

    Keys: battery_mv (int), battery_pct (int), is_charging (bool), result (bool)
    """
    battery = _get_reported(event).get("battery")
    if not isinstance(battery, dict):
        return None

    return {
        "battery_mv": to_int(battery.get("battery_mv")),
        "battery_pct": to_int(battery.get("battery_pct")),
        "is_charging": bool(battery["is_charging"]) if battery.get("is_charging") is not None else None,
        "result": bool(battery["result"]) if battery.get("result") is not None else None,
    }
