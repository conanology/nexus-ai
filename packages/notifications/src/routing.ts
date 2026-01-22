/**
 * Alert routing utility
 *
 * Routes alerts to appropriate channels based on alert type and configuration.
 *
 * @module notifications/routing
 */

import { createLogger } from '@nexus-ai/core';
import type { DiscordEmbedField } from './types.js';
import { ALERT_ROUTING } from './types.js';
import { sendDiscordAlert, formatCriticalAlert } from './discord.js';
import { sendAlertEmail } from './email.js';

const logger = createLogger('notifications.routing');

/**
 * Route an alert to appropriate channels
 *
 * @param alertType - Type of alert (e.g., 'pipeline-failed-no-buffer')
 * @param data - Alert data
 */
export async function routeAlert(
  alertType: string,
  data: {
    title: string;
    description: string;
    fields?: DiscordEmbedField[];
  }
): Promise<void> {
  const config = ALERT_ROUTING[alertType];

  if (!config) {
    logger.warn({ alertType }, 'Unknown alert type, defaulting to Discord INFO');
    await sendDiscordAlert({
      severity: 'INFO',
      title: data.title,
      description: data.description,
      fields: data.fields,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.info(
    {
      alertType,
      severity: config.severity,
      sendDiscord: config.sendDiscord,
      sendEmail: config.sendEmail,
    },
    'Routing alert to channels'
  );

  const promises: Promise<unknown>[] = [];

  if (config.sendDiscord) {
    promises.push(
      sendDiscordAlert({
        severity: config.severity,
        title: data.title,
        description: data.description,
        fields: data.fields,
        timestamp: new Date().toISOString(),
      })
    );
  }

  if (config.sendEmail) {
    promises.push(
      sendAlertEmail({
        subject: `[${config.severity}] ${data.title}`,
        body: `${data.description}\n\n${formatFieldsAsText(data.fields)}`,
        severity: config.severity,
      })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Send a critical alert to all channels
 *
 * Convenience function for immediate critical alerts.
 *
 * @param title - Alert title
 * @param description - Alert description
 * @param fields - Optional fields
 */
export async function sendCriticalAlert(
  title: string,
  description: string,
  fields?: DiscordEmbedField[]
): Promise<void> {
  logger.info({ title }, 'Sending critical alert to all channels');

  const config = formatCriticalAlert(title, description, fields);

  // Send to both channels in parallel
  const [discordResult, emailResult] = await Promise.allSettled([
    sendDiscordAlert(config),
    sendAlertEmail({
      subject: `[CRITICAL] ${title}`,
      body: `${description}\n\n${formatFieldsAsText(fields)}`,
      severity: 'CRITICAL',
    }),
  ]);

  if (discordResult.status === 'rejected') {
    logger.error(
      { error: (discordResult.reason as Error).message },
      'Failed to send critical alert to Discord'
    );
  }

  if (emailResult.status === 'rejected') {
    logger.error(
      { error: (emailResult.reason as Error).message },
      'Failed to send critical alert email'
    );
  }
}

/**
 * Format fields as plain text for email
 *
 * @param fields - Discord embed fields
 * @returns Plain text representation
 */
function formatFieldsAsText(fields?: DiscordEmbedField[]): string {
  if (!fields || fields.length === 0) {
    return '';
  }

  return fields.map((f) => `${f.name}: ${f.value}`).join('\n');
}
