import {
  CHARGING_STOP_SUPPRESS_MIN_PCT,
  LOW_MESSAGES,
  LOW_THRESHOLD,
  RECOVERY_MESSAGES,
  RECOVERY_THRESHOLD,
  THING_NAME,
} from './config';
import { writeBatteryData, writeMoistureData, writeTemperatureData } from './db-writer';
import { sendDeviceHealthDiscordEmbed, sendDiscordEmbed } from './discord-notifier';
import {
  BatteryInfo,
  ShadowEvent,
  extractBattery,
  extractFirmwareVersion,
  extractMoisture,
  extractMoistureRaw,
  extractMoistureResult,
  extractTemperature,
} from './event-parser';
import { getReportedFlags, updateReportedFlags } from '../../shared/iot-shadow-flags';

const SHADOW_FLAG_KEYS = ['alerted', 'charging_alerted'] as const;

interface LambdaResult {
  statusCode: number;
  body: string;
}

function pickRandom(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Format battery info as a string to append to notification text. */
function batteryLine(battery: BatteryInfo | null): string {
  if (!battery || battery.battery_pct === null) return '';
  const pct = battery.battery_pct;
  const mv = battery.battery_mv;
  const charging = battery.is_charging;
  const parts = [`\nバッテリー: **${pct}%**`];
  if (mv !== null) parts.push(`(${mv} mV)`);
  if (charging) parts.push('⚡ 充電中');
  return parts.join(' ');
}

export const handler = async (event: ShadowEvent): Promise<LambdaResult> => {
  console.log(`Received event: ${JSON.stringify(event)}`);

  const moisture = extractMoisture(event);
  const moistureResult = extractMoistureResult(event);
  const moistureRaw = extractMoistureRaw(event);
  const battery = extractBattery(event);
  const temperature = extractTemperature(event);
  const firmwareVersion = extractFirmwareVersion(event);
  const thingName = event?.thing_name ?? THING_NAME;
  const flags = await getReportedFlags(thingName, SHADOW_FLAG_KEYS);

  console.log(
    `Parsed: moisture=${moisture}, moisture_result=${moistureResult}, moisture_raw=${moistureRaw}, ` +
      `battery=${JSON.stringify(battery)}, temperature=${JSON.stringify(temperature)}, ` +
      `firmware_version=${firmwareVersion}, flags=${JSON.stringify(flags)}, thing_name=${thingName}`,
  );

  // センサー読み取り失敗(result === false)時は moisture 値を信用しない。
  // 未接続/未設置のセンサーはG33のフローティングで 0 や 100 を "正常値" として送ってくる
  // ことがあり（既知の症状）、そのままだとグラフを汚し、水分不足アラートも誤発報する。
  // 行自体は診断用に残す（result=false で記録）が、moisture は null にして
  // グラフ描画・水分チェックの対象から外す。
  const moistureReadOk = moistureResult !== false;
  const usableMoisture = moistureReadOk ? moisture : null;

  // 受信データを問わず毎回DynamoDBに記録
  await writeMoistureData(thingName, usableMoisture, moistureResult, flags.alerted, moistureRaw);
  await writeBatteryData(thingName, battery, firmwareVersion);
  await writeTemperatureData(thingName, temperature);

  const battLine = batteryLine(battery);
  const actions: string[] = [];

  // 給電停止/再開チェック（水分データの有無とは独立に毎回実行する）。
  // 満充電付近(CHARGING_STOP_SUPPRESS_MIN_PCT%以上)での給電停止は、充電IC側の正常な
  // 充電完了/再充電サイクルであり実際のリスクではないため、停止アラートの対象から除外する。
  // それ以外は待ち時間を設けず従来どおり即時通知する（バッテリー容量が小さく、本当に給電が
  // 止まった場合は短時間で電池切れになりうるため）。
  const isCharging = battery?.is_charging ?? null;
  const batteryPct = battery?.battery_pct ?? null;
  const isNormalFullChargeCycle = batteryPct !== null && batteryPct >= CHARGING_STOP_SUPPRESS_MIN_PCT;

  if (isCharging === false && !flags.charging_alerted && !isNormalFullChargeCycle) {
    const text = `**${thingName}**\n⚡ 給電が停止しました。まもなく稼働が停止する可能性があります。${battLine}`;
    await sendDeviceHealthDiscordEmbed('🔌 給電停止アラート', text, 0xffa500);
    await updateReportedFlags(thingName, { charging_alerted: true });
    actions.push('charging stop alert sent');
  } else if (isCharging === true && flags.charging_alerted) {
    const text = `**${thingName}**\n🔌 給電が再開しました。${battLine}`;
    await sendDeviceHealthDiscordEmbed('🔌 給電再開', text, 0x4ecdc4);
    await updateReportedFlags(thingName, { charging_alerted: false });
    actions.push('charging resume sent');
  }

  if (usableMoisture === null) {
    console.log(`Moisture not usable (moisture=${moisture}, result=${moistureResult}). Skip moisture check.`);
    return { statusCode: 200, body: actions.length > 0 ? actions.join(', ') : 'skipped: no moisture' };
  }

  console.log(`Check: moisture=${usableMoisture}, alerted=${flags.alerted}`);

  if (usableMoisture <= LOW_THRESHOLD && !flags.alerted) {
    const text = `**${thingName}**\n${pickRandom(LOW_MESSAGES)}\n現在の水分: **${usableMoisture}%**${battLine}`;
    await sendDiscordEmbed('🚨 水分不足アラート', text, 0xff6b6b);
    await updateReportedFlags(thingName, { alerted: true });
    actions.push('low alert sent');
  } else if (usableMoisture >= RECOVERY_THRESHOLD && flags.alerted) {
    const text = `**${thingName}**\n${pickRandom(RECOVERY_MESSAGES)}\n現在の水分: **${usableMoisture}%**${battLine}`;
    await sendDiscordEmbed('✅ 回復通知', text, 0x4ecdc4); // 緑青系
    await updateReportedFlags(thingName, { alerted: false });
    actions.push('recovery sent');
  }

  if (actions.length === 0) {
    console.log('No action taken.');
    return { statusCode: 200, body: 'no action' };
  }

  return { statusCode: 200, body: actions.join(', ') };
};
