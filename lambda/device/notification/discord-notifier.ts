import { DISCORD_WEBHOOK_URL } from './config';

export async function sendDiscordEmbed(title: string, description: string, color = 0x2ecc71): Promise<string> {
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

  const res = await fetch(`${DISCORD_WEBHOOK_URL}?wait=true`, {
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
