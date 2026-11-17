import { getStore } from '@netlify/blobs';
import { runReminders } from '../lib/notify.mjs';
import { createPush } from '../lib/push.mjs';

// Läuft stündlich; jede Person erhält die Zusammenfassung zu ihrer gewählten Uhrzeit
// (Zeitzone APP_TIMEZONE, Standard Europe/Zurich).
export default async () => {
  const store = getStore({ name: 'putzplan', consistency: 'strong' });
  const r = await runReminders({ store, push: createPush(store) });
  console.log('Push-Zusammenfassungen gesendet:', r.sent);
};

export const config = { schedule: '@hourly' };
