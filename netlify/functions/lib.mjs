import crypto from 'node:crypto';
import { buildDigest, localNow, sendMail } from './mail.mjs';
import { addInterval, nextDueAfter, setupCalendar } from './schedule.mjs';

const UNITS = ['day', 'week', 'month', 'year'];

class HttpError extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const uid = () => crypto.randomUUID();
const todayUTC = () => new Date().toISOString().slice(0, 10);

export { addInterval };

// ---------- Auth ----------
const sign = (p, secret) => crypto.createHmac('sha256', secret).update(p).digest('base64url');

function makeToken(userId, secret) {
  const p = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 90 })).toString('base64url');
  return `${p}.${sign(p, secret)}`;
}

function readToken(tok, secret) {
  if (!tok) return null;
  const [p, s] = tok.split('.');
  if (!p || !s) return null;
  const exp = sign(p, secret);
  if (s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() ? d.uid : null;
  } catch { return null; }
}

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}

function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 64), Buffer.from(h, 'hex'));
}

// ---------- Tasks ----------
function cleanTask(b, db, existing = null) {
  const t = existing ? { ...existing } : {
    id: uid(), area: '', notes: '', intervalValue: 1, intervalUnit: 'week',
    schedule: 'completion', assignMode: 'none', assignee: null, members: [],
    nextDue: todayUTC(), lastDone: null,
  };
  if (b.title !== undefined) t.title = String(b.title).trim().slice(0, 120);
  if (!t.title) throw new HttpError('Titel fehlt');
  if (b.area !== undefined) t.area = String(b.area || '').trim().slice(0, 60);
  if (b.notes !== undefined) t.notes = String(b.notes || '').slice(0, 2000);
  if (b.intervalValue !== undefined) {
    const n = parseInt(b.intervalValue, 10);
    if (!(n >= 1 && n <= 999)) throw new HttpError('Intervall muss zwischen 1 und 999 liegen');
    t.intervalValue = n;
  }
  if (b.intervalUnit !== undefined) {
    if (!UNITS.includes(b.intervalUnit)) throw new HttpError('Ungültige Intervall-Einheit');
    t.intervalUnit = b.intervalUnit;
  }
  if (b.schedule !== undefined) t.schedule = ['fixed', 'calendar'].includes(b.schedule) ? b.schedule : 'completion';
  if (b.weekdays !== undefined) {
    t.weekdays = [...new Set((Array.isArray(b.weekdays) ? b.weekdays : []).map(Number))].filter((d) => d >= 1 && d <= 7).sort();
  }
  if (b.monthDay !== undefined) {
    const md = parseInt(b.monthDay, 10);
    if (!(md === -1 || (md >= 1 && md <= 31))) throw new HttpError('Ungültiger Tag im Monat');
    t.monthDay = md;
  }
  if (b.yearDate !== undefined) {
    const m = /^(\d{2})-(\d{2})$/.exec(String(b.yearDate));
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > new Date(Date.UTC(2024, +m[1], 0)).getUTCDate()) throw new HttpError('Ungültiges Datum (TT.MM.)');
    t.yearDate = b.yearDate;
  }
  if (b.assignMode !== undefined) t.assignMode = ['none', 'fixed', 'rotate'].includes(b.assignMode) ? b.assignMode : 'none';
  const ids = db.users.map((u) => u.id);
  if (b.members !== undefined) t.members = (Array.isArray(b.members) ? b.members : []).filter((id) => ids.includes(id));
  if (b.assignee !== undefined) t.assignee = ids.includes(b.assignee) ? b.assignee : null;
  if (b.nextDue !== undefined) {
    if (!isDate(b.nextDue)) throw new HttpError('Ungültiges Datum');
    t.nextDue = b.nextDue;
  }
  if (t.schedule === 'calendar') {
    if (t.intervalUnit === 'day') throw new HttpError('Für „Bestimmter Tag“ Woche, Monat oder Jahr wählen');
    if (t.intervalValue > 99) throw new HttpError('Bei „Bestimmter Tag“ max. 99');
    const [, mm, dd] = t.nextDue.split('-');
    const dow = ((new Date(t.nextDue + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
    if (t.intervalUnit === 'week' && !t.weekdays?.length) t.weekdays = [dow];
    if (t.intervalUnit === 'month' && !t.monthDay) t.monthDay = +dd;
    if (t.intervalUnit === 'year' && !t.yearDate) t.yearDate = `${mm}-${dd}`;
    setupCalendar(t);
  }
  if (t.assignMode === 'none') t.assignee = null;
  if (t.assignMode === 'rotate') {
    if (!t.members.length) t.members = [...ids];
    if (!t.members.includes(t.assignee)) t.assignee = t.members[0] || null;
  }
  return t;
}

function advance(task, date, db) {
  task.nextDue = nextDueAfter(task, date);
  if (task.assignMode === 'rotate') {
    const pool = task.members.filter((id) => db.users.some((x) => x.id === id));
    if (pool.length) task.assignee = pool[(pool.indexOf(task.assignee) + 1) % pool.length];
  }
}

const publicUser = (u) => ({ id: u.id, name: u.name, admin: !!u.admin, createdAt: u.createdAt });

function stateFor(db, me) {
  return {
    me: { ...publicUser(me), email: me.email || '', notify: me.notify || 'off', notifyScope: me.notifyScope || 'mine', notifyHour: me.notifyHour ?? 7 },
    mailEnabled: !!process.env.RESEND_API_KEY,
    users: db.users.map(publicUser),
    tasks: db.tasks,
    log: [...db.log].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 500),
  };
}

// ---------- Handler ----------
export function createApi({ store, teamCode, secret }) {
  const load = async () => (await store.get('db', { type: 'json' })) || { users: [], tasks: [], log: [] };
  const save = (db) => store.setJSON('db', db);

  return async function handler(req) {
    try {
      if (!secret) throw new HttpError('Server nicht konfiguriert: SESSION_SECRET fehlt', 500);
      const url = new URL(req.url);
      const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      const method = req.method;
      let b = {};
      if (method === 'POST' || method === 'PUT') { try { b = await req.json(); } catch { b = {}; } }
      const db = await load();

      // --- öffentlich ---
      if (parts[0] === 'register' && method === 'POST') {
        if (teamCode && String(b.teamCode || '').trim() !== teamCode) throw new HttpError('Team-Code falsch', 403);
        const name = String(b.name || '').trim().slice(0, 40);
        const pw = String(b.password || '');
        if (name.length < 2) throw new HttpError('Name zu kurz');
        if (pw.length < 6) throw new HttpError('Passwort: mindestens 6 Zeichen');
        if (db.users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new HttpError('Name bereits vergeben');
        const email = String(b.email || '').trim().slice(0, 200);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError('Ungültige E-Mail-Adresse');
        const user = {
          id: uid(), name, pw: hashPw(pw), admin: db.users.length === 0, createdAt: new Date().toISOString(),
          email, notify: email ? 'daily' : 'off', notifyScope: 'mine', notifyHour: 7,
        };
        db.users.push(user);
        await save(db);
        return json({ token: makeToken(user.id, secret) });
      }
      if (parts[0] === 'login' && method === 'POST') {
        const name = String(b.name || '').trim().toLowerCase();
        const user = db.users.find((u) => u.name.toLowerCase() === name);
        if (!user || !checkPw(String(b.password || ''), user.pw)) throw new HttpError('Name oder Passwort falsch', 401);
        return json({ token: makeToken(user.id, secret) });
      }

      // --- ab hier angemeldet ---
      const userId = readToken((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), secret);
      const me = db.users.find((u) => u.id === userId);
      if (!me) throw new HttpError('Nicht angemeldet', 401);

      const done = async () => { await save(db); return json(stateFor(db, me)); };

      if (parts[0] === 'state' && method === 'GET') return json(stateFor(db, me));

      if (parts[0] === 'me' && method === 'PUT') {
        if (b.password !== undefined) {
          if (!checkPw(String(b.oldPassword || ''), me.pw)) throw new HttpError('Altes Passwort falsch', 403);
          if (String(b.password).length < 6) throw new HttpError('Passwort: mindestens 6 Zeichen');
          me.pw = hashPw(String(b.password));
        }
        if (b.email !== undefined) {
          const email = String(b.email || '').trim().slice(0, 200);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError('Ungültige E-Mail-Adresse');
          me.email = email;
        }
        if (b.notify !== undefined) me.notify = b.notify === 'daily' ? 'daily' : 'off';
        if (b.notifyScope !== undefined) me.notifyScope = b.notifyScope === 'all' ? 'all' : 'mine';
        if (b.notifyHour !== undefined) {
          const h = parseInt(b.notifyHour, 10);
          if (!(h >= 0 && h <= 23)) throw new HttpError('Ungültige Uhrzeit');
          me.notifyHour = h;
        }
        if (me.notify === 'daily' && !me.email) throw new HttpError('Für Erinnerungen bitte E-Mail-Adresse angeben');
        return done();
      }

      if (parts[0] === 'me' && parts[1] === 'testmail' && method === 'POST') {
        if (!me.email) throw new HttpError('Keine E-Mail-Adresse hinterlegt');
        const { date } = localNow();
        const appUrl = process.env.APP_URL || process.env.URL || '';
        const d = buildDigest(db, { ...me, notifyScope: me.notifyScope || 'mine' }, date, appUrl) || {
          subject: '🧽 Putzplan: Test-Mail',
          html: `<p>Hallo ${me.name.replace(/[<>&]/g, '')} 👋</p><p>Erinnerungen funktionieren. Aktuell ist nichts fällig. 🎉</p>`,
          text: `Hallo ${me.name}\n\nErinnerungen funktionieren. Aktuell ist nichts fällig.`,
        };
        try { await sendMail({ to: me.email, subject: d.subject, html: d.html, text: d.text }); }
        catch (e) { throw new HttpError('Versand fehlgeschlagen: ' + e.message, 502); }
        return json({ ok: true });
      }

      if (parts[0] === 'users' && parts[1] && method === 'DELETE') {
        if (!me.admin) throw new HttpError('Nur Admins dürfen Mitglieder entfernen', 403);
        if (parts[1] === me.id) throw new HttpError('Du kannst dich nicht selbst entfernen');
        db.users = db.users.filter((u) => u.id !== parts[1]);
        for (const t of db.tasks) {
          t.members = (t.members || []).filter((id) => id !== parts[1]);
          if (t.assignee === parts[1]) t.assignee = t.assignMode === 'rotate' ? (t.members[0] || null) : null;
        }
        return done();
      }

      if (parts[0] === 'tasks') {
        const id = parts[1];
        if (!id && method === 'POST') {
          const t = cleanTask(b, db);
          t.createdBy = me.id; t.createdAt = new Date().toISOString();
          db.tasks.push(t);
          return done();
        }
        if (id === 'bulk' && method === 'POST') {
          const list = Array.isArray(b.tasks) ? b.tasks.slice(0, 200) : [];
          for (const item of list) {
            const t = cleanTask(item, db);
            t.createdBy = me.id; t.createdAt = new Date().toISOString();
            db.tasks.push(t);
          }
          return done();
        }
        const task = db.tasks.find((t) => t.id === id);
        if (!task) throw new HttpError('Aufgabe nicht gefunden', 404);

        if (!parts[2] && method === 'PUT') {
          Object.assign(task, cleanTask(b, db, task));
          return done();
        }
        if (!parts[2] && method === 'DELETE') {
          db.tasks = db.tasks.filter((t) => t.id !== id);
          db.log = db.log.filter((l) => l.taskId !== id);
          return done();
        }
        if ((parts[2] === 'done' || parts[2] === 'skip') && method === 'POST') {
          const date = isDate(b.date) ? b.date : todayUTC();
          const entry = {
            id: uid(), taskId: id, taskTitle: task.title, userId: me.id,
            type: parts[2], date, note: String(b.note || '').slice(0, 500), at: new Date().toISOString(),
            prev: { nextDue: task.nextDue, lastDone: task.lastDone, assignee: task.assignee },
          };
          if (parts[2] === 'done') task.lastDone = !task.lastDone || date > task.lastDone ? date : task.lastDone;
          advance(task, date, db);
          db.log.push(entry);
          return done();
        }
      }

      if (parts[0] === 'log' && parts[1] && method === 'DELETE') {
        const entry = db.log.find((l) => l.id === parts[1]);
        if (!entry) throw new HttpError('Eintrag nicht gefunden', 404);
        const task = db.tasks.find((t) => t.id === entry.taskId);
        const latest = db.log.filter((l) => l.taskId === entry.taskId).sort((a, b) => (b.at > a.at ? 1 : -1))[0];
        if (task && latest && latest.id === entry.id && entry.prev) Object.assign(task, entry.prev);
        db.log = db.log.filter((l) => l.id !== entry.id);
        return done();
      }

      throw new HttpError('Nicht gefunden', 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Serverfehler' }, 500);
    }
  };
}
