import {
  GetThingShadowCommand,
  IoTDataPlaneClient,
  UpdateThingShadowCommand,
} from '@aws-sdk/client-iot-data-plane';

const client = new IoTDataPlaneClient({});

export async function getAlertedFlag(thingName: string): Promise<boolean> {
  try {
    const response = await client.send(new GetThingShadowCommand({ thingName }));
    const payloadText = new TextDecoder('utf-8').decode(response.payload);
    const payload = JSON.parse(payloadText);
    return Boolean(payload?.state?.reported?.alerted ?? false);
  } catch (e) {
    console.error(`Shadow get error: ${e}`);
    return false;
  }
}

export async function updateShadowAlerted(thingName: string, status: boolean): Promise<void> {
  const payload = { state: { reported: { alerted: status } } };
  await client.send(
    new UpdateThingShadowCommand({
      thingName,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
}
