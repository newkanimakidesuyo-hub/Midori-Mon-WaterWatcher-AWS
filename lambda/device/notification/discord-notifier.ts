import { createDiscordNotifier } from '../../shared/discord-notifier';
import { DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME, DISCORD_WEBHOOK_URL_PARAM_NAME } from './config';

// 水分不足/回復の通知
export const sendDiscordEmbed = createDiscordNotifier(DISCORD_WEBHOOK_URL_PARAM_NAME);

// 給電停止/再開の通知（水分不足とは別チャンネル）
export const sendDeviceHealthDiscordEmbed = createDiscordNotifier(DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME);
