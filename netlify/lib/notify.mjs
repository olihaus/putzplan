// Tägliche Zusammenfassung per Push-Nachricht
import { pruneSubs } from './push.mjs';

const TZ = () => process.env.APP_TIMEZONE || 'Europe/Zurich';

export function localNow(date = new Date(), tz = TZ()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Offene Aufgaben, die heute oder früher fällig sind und diese Person betreffen. */
export function dueTasksFor(db, user, today) {
  return db.tasks
    .filter((t) => !t.completedAt && t.nextDue && t.nextDue <= today)
    .filter((t) => user.notifyScope === 'all' || t.assignee === user.id || !t.assignee)
    .sort((a, b) => (a.nextDue > b.nextDue ? 1 : -1));
}

export function buildDigest(db, user, today) {
  const tasks = dueTasksFor(db, user, today);
  if (!tasks.length) return null;
  const over = tasks.filter((t) => t.nextDue < today).length;
  const names = tasks.slice(0, 4).map((t) => t.title).join(', ') + (tasks.length > 4 ? ` +${tasks.length - 4}` : '');
  return {
    title: `${tasks.length} Aufgabe${tasks.length === 1 ? '' : 'n'} fällig${over ? ` · ${over} überfällig` : ''}`,
    body: names,
    url: '/',
    tag: 'digest',
  };
}

/** Wird stündlich ausgeführt; schickt jeder Person zu ihrer Wunsch-Stunde max. 1 Zusammenfassung pro Tag. */
export async function runReminders({ store, push, now = new Date() }) {
  const db = await store.get('db', { type: 'json' });
  if (!db) return { sent: 0 };
  const { date, hour } = localNow(now);
  const updates = new Map();
  let sent = 0;
  for (const u of db.users) {
    if ((u.notify ?? 'daily') !== 'daily' || !(u.pushSubs || []).length || u.lastDigest === date) continue;
    if (hour < (u.notifyHour ?? 7)) continue; // ab Wunsch-Stunde; holt verpasste Läufe nach
    const d = buildDigest(db, u, date);
    const upd = { lastDigest: date, dead: [] };
    if (d) {
      const r = await push.sendToUser(u, d);
      sent += r.sent;
      upd.dead = r.dead;
      if (!r.sent && !r.dead.length) upd.lastDigest = u.lastDigest ?? null; // Fehler: nächste Stunde erneut versuchen
    }
    updates.set(u.id, upd);
  }
  if (updates.size) {
    // frisch laden, damit parallele Änderungen aus der App nicht überschrieben werden
    const fresh = await store.get('db', { type: 'json' });
    for (const u of fresh.users) {
      const upd = updates.get(u.id);
      if (!upd) continue;
      u.lastDigest = upd.lastDigest;
      pruneSubs(u, upd.dead);
    }
    await store.setJSON('db', fresh);
  }
  return { sent };
}
