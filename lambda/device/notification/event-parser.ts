export type ShadowEvent = Record<string, any>;

export interface BatteryInfo {
  battery_mv: number | null;
  battery_pct: number | null;
  is_charging: boolean | null;
  result: boolean | null;
}

export interface TemperatureInfo {
  temperature_c: number | null;
  result: boolean | null;
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}

function toBool(value: unknown): boolean | null {
  return value !== null && value !== undefined ? Boolean(value) : null;
}

/** Return the state.reported object from an IoT Shadow event. */
function getReported(event: ShadowEvent | null | undefined): Record<string, any> {
  return event?.state?.reported ?? {};
}

export function extractMoisture(event: ShadowEvent): number | null {
  const reported = getReported(event);

  // New shape: state.reported.moisture_sensor_unit.moisture
  const unit = reported.moisture_sensor_unit ?? {};
  if (unit.moisture !== null && unit.moisture !== undefined) {
    return toInt(unit.moisture);
  }

  // Legacy flat shape: state.reported.moisture
  if (reported.moisture !== null && reported.moisture !== undefined) {
    return toInt(reported.moisture);
  }

  // IoT Rule SQL flat event: { "moisture": 58 }
  if (event && event.moisture !== null && event.moisture !== undefined) {
    return toInt(event.moisture);
  }

  return null;
}

/** Return moisture_sensor_unit.result (bool), or null if absent. */
export function extractMoistureResult(event: ShadowEvent): boolean | null {
  const unit = getReported(event).moisture_sensor_unit ?? {};
  return toBool(unit.result);
}

/**
 * Return moisture_sensor_unit.raw (センサーのサンプル平均生値), or null if absent.
 * 未接続センサーの切り分けや校正帯域の見直しに使う診断値。
 */
export function extractMoistureRaw(event: ShadowEvent): number | null {
  const unit = getReported(event).moisture_sensor_unit ?? {};
  const raw = toInt(unit.raw);
  // 生値なしを表すファーム側の番兵(-1)はnull扱いにする
  return raw === null || raw < 0 ? null : raw;
}

/**
 * Return temperature_sensor fields as an object, or null if the group is absent.
 *
 * Keys: temperature_c (number), result (boolean)
 */
export function extractTemperature(event: ShadowEvent): TemperatureInfo | null {
  const temp = getReported(event).temperature_sensor;
  if (typeof temp !== 'object' || temp === null) return null;

  const temperatureC = temp.temperature_c;
  return {
    temperature_c: temperatureC !== null && temperatureC !== undefined ? Number(temperatureC) : null,
    result: toBool(temp.result),
  };
}

/**
 * Return battery fields as an object, or null if the battery group is absent.
 *
 * Keys: battery_mv (number), battery_pct (number), is_charging (boolean), result (boolean)
 */
export function extractBattery(event: ShadowEvent): BatteryInfo | null {
  const battery = getReported(event).battery;
  if (typeof battery !== 'object' || battery === null) return null;

  return {
    battery_mv: toInt(battery.battery_mv),
    battery_pct: toInt(battery.battery_pct),
    is_charging: toBool(battery.is_charging),
    result: toBool(battery.result),
  };
}

/** Return state.reported.system.firmware_version (ビルド時点のgitコミットハッシュ), or null if absent. */
export function extractFirmwareVersion(event: ShadowEvent): string | null {
  const system = getReported(event).system;
  if (typeof system !== 'object' || system === null) return null;

  const version = system.firmware_version;
  return typeof version === 'string' && version.length > 0 ? version : null;
}
