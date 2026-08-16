import { createDiscordNotifier } from '../../shared/discord-notifier';
import { DISCORD_WEBHOOK_URL_PARAM_NAME } from './config';

export const sendDiscordEmbed = createDiscordNotifier(DISCORD_WEBHOOK_URL_PARAM_NAME);
