import { LOW_MESSAGES, LOW_THRESHOLD, RECOVERY_MESSAGES, RECOVERY_THRESHOLD, THING_NAME } from './config';
import { writeBatteryData, writeMoistureData, writeTemperatureData } from './db-writer';
import { sendDiscordEmbed } from './discord-notifier';
import { BatteryInfo, ShadowEvent, extractBattery, extractMoisture, extractMoistureResult, extractTemperature } from './event-parser';
import { getAlertedFlag, updateShadowAlerted } from './iot-shadow';

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
  const battery = extractBattery(event);
  const temperature = extractTemperature(event);
  const thingName = event?.thing_name ?? THING_NAME;
  const alreadyAlerted = await getAlertedFlag(thingName);

  console.log(
    `Parsed: moisture=${moisture}, moisture_result=${moistureResult}, ` +
      `battery=${JSON.stringify(battery)}, temperature=${JSON.stringify(temperature)}, alerted=${alreadyAlerted}, thing_name=${thingName}`,
  );

  // 受信データを問わず毎回DynamoDBに記録
  await writeMoistureData(thingName, moisture, moistureResult, alreadyAlerted);
  await writeBatteryData(thingName, battery);
  await writeTemperatureData(thingName, temperature);

  if (moisture === null) {
    console.log('Moisture not found. Skip.');
    return { statusCode: 200, body: 'skipped: no moisture' };
  }

  console.log(`Check: moisture=${moisture}, alerted=${alreadyAlerted}`);

  const battLine = batteryLine(battery);

  if (moisture <= LOW_THRESHOLD && !alreadyAlerted) {
    const text = `**${thingName}**\n${pickRandom(LOW_MESSAGES)}\n現在の水分: **${moisture}%**${battLine}`;
    await sendDiscordEmbed('🚨 水分不足アラート', text, 0xff6b6b);
    await updateShadowAlerted(thingName, true);
    return { statusCode: 200, body: 'low alert sent' };
  }

  if (moisture >= RECOVERY_THRESHOLD && alreadyAlerted) {
    const text = `**${thingName}**\n${pickRandom(RECOVERY_MESSAGES)}\n現在の水分: **${moisture}%**${battLine}`;
    await sendDiscordEmbed('✅ 回復通知', text, 0x4ecdc4); // 緑青系
    await updateShadowAlerted(thingName, false);
    return { statusCode: 200, body: 'recovery sent' };
  }

  console.log('No action taken.');
  return { statusCode: 200, body: 'no action' };
};
