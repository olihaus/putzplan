// E-Mail-Erinnerungen via Resend
const TZ = () => process.env.APP_TIMEZONE || 'Europe/Zurich';

export function localNow(date = new Date(), tz = TZ()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayNum = (ds) => { const [y, m, d] = ds.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const fmt = (ds) => ds.split('-').reverse().join('.');

/** Aufgaben, die für diese Person heute relevant sind (überfällig + heute). */
export function dueTasksFor(db, user, today) {
  return db.tasks
    .filter((t) => t.nextDue <= today)
    .filter((t) => user.notifyScope === 'all' || t.assignee === user.id || !t.assignee)
    .sort((a, b) => (a.nextDue > b.nextDue ? 1 : -1));
}

export function buildDigest(db, user, today, appUrl = '') {
  const tasks = dueTasksFor(db, user, today);
  if (!tasks.length) return null;
  const name = (id) => db.users.find((u) => u.id === id)?.name || '';
  const over = tasks.filter((t) => t.nextDue < today).length;
  const subject = `🧽 Putzplan: ${tasks.length} Aufgabe${tasks.length === 1 ? '' : 'n'} fällig${over ? ` (${over} überfällig)` : ''}`;
  const rows = tasks.map((t) => {
    const late = dayNum(today) - dayNum(t.nextDue);
    const badge = late > 0
      ? `<span style="color:#dc2626;font-weight:600">${late} ${late === 1 ? 'Tag' : 'Tage'} überfällig</span>`
      : '<span style="color:#b45309;font-weight:600">heute</span>';
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
      <div style="font-weight:600">${esc(t.title)}</div>
      <div style="font-size:13px;color:#6b7280">${badge}${t.area ? ' · ' + esc(t.area) : ''}${t.assignee ? ' · 👤 ' + esc(name(t.assignee)) : ''}</div>
    </td></tr>`;
  }).join('');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#18202a">
    <h2 style="color:#0f766e;margin-bottom:4px">Hallo ${esc(user.name)} 👋</h2>
    <p style="margin-top:0;color:#6b7280">Das steht am ${fmt(today)} an:</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    ${appUrl ? `<p style="margin:22px 0"><a href="${esc(appUrl)}" style="background:#0f766e;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:600">Putzplan öffnen</a></p>` : ''}
    <p style="font-size:12px;color:#9ca3af">Erinnerungen kannst du in der App unter 👤 → Erinnerungen ändern oder abschalten.</p></div>`;
  const text = `Hallo ${user.name}\n\nFällig am ${fmt(today)}:\n` +
    tasks.map((t) => `- ${t.title} (${t.nextDue < today ? 'überfällig seit ' + fmt(t.nextDue) : 'heute'})`).join('\n') +
    (appUrl ? `\n\n${appUrl}` : '');
  return { subject, html, text, count: tasks.length };
}

export async function sendMail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY fehlt');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Putzplan <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Wird stündlich ausgeführt; schickt jeder Person zu ihrer Wunsch-Stunde max. 1 Mail pro Tag. */
export async function runReminders({ store, send = sendMail, now = new Date(), appUrl = process.env.APP_URL || process.env.URL || '' }) {
  const db = await store.get('db', { type: 'json' });
  if (!db) return { sent: 0 };
  const { date, hour } = localNow(now);
  let sent = 0, changed = false;
  for (const u of db.users) {
    if (u.notify !== 'daily' || !u.email || u.lastDigest === date) continue;
    if (hour < (u.notifyHour ?? 7)) continue; // erst ab Wunsch-Stunde; holt verpasste Läufe nach
    const d = buildDigest(db, u, date, appUrl);
    u.lastDigest = date; changed = true;
    if (!d) continue;
    try { await send({ to: u.email, ...d }); sent++; } catch (e) { console.error('Mail an', u.name, 'fehlgeschlagen:', e.message); u.lastDigest = null; }
  }
  if (changed) {
    // nur lastDigest zurückschreiben, frisch geladen, um parallele Änderungen nicht zu überschreiben
    const fresh = await store.get('db', { type: 'json' });
    for (const u of fresh.users) { const m = db.users.find((x) => x.id === u.id); if (m) u.lastDigest = m.lastDigest; }
    await store.setJSON('db', fresh);
  }
  return { sent };
}
