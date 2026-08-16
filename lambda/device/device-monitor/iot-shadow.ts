import {
  GetThingShadowCommand,
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane';

const client = new IoTDataPlaneClient({});

/** state.reported.offline_alerted（無応答アラート済みかどうか）を取得する。 */
export async function getOfflineAlertedFlag(thingName: string): Promise<boolean> {
  try {
    const response = await client.send(new GetThingShadowCommand({ thingName }));
    const payloadText = new TextDecoder('utf-8').decode(response.payload);
    const payload = JSON.parse(payloadText);
    return Boolean(payload?.state?.reported?.offline_alerted ?? false);
  } catch (e) {
    console.error(`Shadow get error (${thingName}): ${e}`);
    return false;
  }
}

/** state.reported.offline_alerted を更新する。 */
export async function updateOfflineAlertedFlag(thingName: string, status: boolean): Promise<void> {
  const payload = { state: { reported: { offline_alerted: status } } };
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
}
