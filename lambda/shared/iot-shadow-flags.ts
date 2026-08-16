import {
  GetThingShadowCommand,
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane';

const client = new IoTDataPlaneClient({});

/**
 * state.reported から、指定したキー群のboolean値をまとめて取得する（GETは1回のみ）。
 * 取得失敗時・未設定時はすべてfalse扱いにする。
 */
export async function getReportedFlags<K extends string>(
  thingName: string,
  keys: readonly K[],
): Promise<Record<K, boolean>> {
  const flags = {} as Record<K, boolean>;

  try {
    const response = await client.send(new GetThingShadowCommand({ thingName }));
    const payloadText = new TextDecoder('utf-8').decode(response.payload);
    const payload = JSON.parse(payloadText);
    const reported = payload?.state?.reported ?? {};
    for (const key of keys) {
      flags[key] = Boolean(reported[key] ?? false);
    }
  } catch (e) {
    console.error(`Shadow get error (${thingName}): ${e}`);
    for (const key of keys) {
      flags[key] = false;
    }
  }

  return flags;
}

/** state.reported のキー群を部分更新する（UPDATEは1回のみ）。 */
export async function updateReportedFlags(thingName: string, updates: Record<string, boolean>): Promise<void> {
  if (Object.keys(updates).length === 0) return;

  const payload = { state: { reported: updates } };
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
}
