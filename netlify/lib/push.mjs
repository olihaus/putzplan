// Web-Push: VAPID-Schlüssel werden beim ersten Gebrauch erzeugt und im Blob-Store abgelegt.
import * as webpush from 'web-push';

export function createPush(store) {
  let cached = null;

  async function vapid() {
    if (cached) return cached;
    let keys = await store.get('vapid', { type: 'json' });
    if (!keys) {
      keys = webpush.generateVAPIDKeys();
      await store.setJSON('vapid', keys);
    }
    cached = keys;
    return keys;
  }

  return {
    async publicKey() { return (await vapid()).publicKey; },

    /** Sendet an alle Geräte einer Person. Gibt Endpoints zurück, die nicht mehr gültig sind. */
    async sendToUser(user, payload) {
      const subs = user.pushSubs || [];
      if (!subs.length) return { sent: 0, dead: [] };
      const keys = await vapid();
      const subject = process.env.VAPID_SUBJECT || process.env.URL || 'https://example.com';
      const dead = [];
      let sent = 0;
      await Promise.allSettled(subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), {
            vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
            TTL: 60 * 60 * 12,
          });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
          else console.error('Push fehlgeschlagen:', e.statusCode, e.body || e.message);
        }
      }));
      return { sent, dead };
    },
  };
}

/** Entfernt ungültige Abos aus dem Benutzer-Objekt. */
export function pruneSubs(user, dead) {
  if (dead?.length) user.pushSubs = (user.pushSubs || []).filter((s) => !dead.includes(s.endpoint));
}
