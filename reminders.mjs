import { getStore } from '@netlify/blobs';
import { runReminders } from './mail.mjs';

// Läuft stündlich; jede Person erhält die Mail zu ihrer gewählten Uhrzeit (Zeitzone APP_TIMEZONE, Standard Europe/Zurich).
export default async () => {
  const r = await runReminders({ store: getStore({ name: 'putzplan', consistency: 'strong' }) });
  console.log('Erinnerungen gesendet:', r.sent);
};

export const config = { schedule: '@hourly' };
