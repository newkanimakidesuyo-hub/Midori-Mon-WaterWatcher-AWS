import {
  GetThingShadowCommand,
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane';

const client = new IoTDataPlaneClient({});

export interface ReportedFlags {
  /** 水分低下アラート済みかどうか */
  alerted: boolean;
  /** 給電停止アラート済みかどうか */
  chargingAlerted: boolean;
}

/** state.reported から通知系フラグをまとめて取得する（GETは1回のみ）。 */
export async function getReportedFlags(thingName: string): Promise<ReportedFlags> {
  try {
    const response = await client.send(new GetThingShadowCommand({ thingName }));
    const payloadText = new TextDecoder('utf-8').decode(response.payload);
    const payload = JSON.parse(payloadText);
    const reported = payload?.state?.reported ?? {};
    return {
      alerted: Boolean(reported.alerted ?? false),
      chargingAlerted: Boolean(reported.charging_alerted ?? false),
    };
  } catch (e) {
    console.error(`Shadow get error: ${e}`);
    return { alerted: false, chargingAlerted: false };
  }
}

/** state.reported の通知系フラグを部分更新する（UPDATEは1回のみ）。 */
export async function updateShadowFlags(thingName: string, updates: Partial<ReportedFlags>): Promise<void> {
  const reported: Record<string, boolean> = {};
  if (updates.alerted !== undefined) reported.alerted = updates.alerted;
  if (updates.chargingAlerted !== undefined) reported.charging_alerted = updates.chargingAlerted;

  if (Object.keys(reported).length === 0) return;

  const payload = { state: { reported } };
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
}
