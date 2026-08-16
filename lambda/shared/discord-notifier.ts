import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({});

// コールドスタート間で使い回すキャッシュ（同一実行環境内のウォーム呼び出しではSSMを叩き直さない）。
// パラメータ名ごとにキャッシュするため、複数のLambdaが異なるWebhookを使う場合も安全。
const webhookUrlCache = new Map<string, string>();

async function getWebhookUrl(paramName: string): Promise<string> {
  const cached = webhookUrlCache.get(paramName);
  if (cached) return cached;

  const result = await ssmClient.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter "${paramName}" has no value`);
  }

  webhookUrlCache.set(paramName, value);
  return value;
}

/** 指定したSSMパラメータ（Discord Webhook URL）を使うsendDiscordEmbed関数を生成する。 */
export function createDiscordNotifier(webhookUrlParamName: string) {
  return async function sendDiscordEmbed(title: string, description: string, color = 0x2ecc71): Promise<string> {
    const webhookUrl = await getWebhookUrl(webhookUrlParamName);

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
  };
}
