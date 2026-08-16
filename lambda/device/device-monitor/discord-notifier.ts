import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

import { DISCORD_WEBHOOK_URL_PARAM_NAME } from './config';

const ssmClient = new SSMClient({});

// コールドスタート間で使い回すキャッシュ（同一実行環境内のウォーム呼び出しではSSMを叩き直さない）
let cachedWebhookUrl: string | undefined;

async function getWebhookUrl(): Promise<string> {
  if (cachedWebhookUrl) return cachedWebhookUrl;

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: DISCORD_WEBHOOK_URL_PARAM_NAME, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter "${DISCORD_WEBHOOK_URL_PARAM_NAME}" has no value`);
  }

  cachedWebhookUrl = value;
  return value;
}

export async function sendDiscordEmbed(title: string, description: string, color = 0x2ecc71): Promise<string> {
  const webhookUrl = await getWebhookUrl();

  const payload = {
    username: 'ミドリモン',
    embeds: [
      {
        title,
        description,
        color,
        footer: { text: 'Midori-Mon WaterWatcher' },
      },
    ],
  };

  const res = await fetch(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Discord HTTPError: ${res.status} ${text}`);
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
  return text;
}
