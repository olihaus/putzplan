import crypto from 'node:crypto';
import { addInterval, nextDueAfter, setupCalendar, yearDatesOf } from './schedule.mjs';
import { pruneSubs } from './push.mjs';
import { trmnlData } from './trmnl.mjs';

const UNITS = ['day', 'week', 'month', 'year'];
const SCHEDULES = ['once', 'completion', 'fixed', 'calendar'];
const MAX_PHOTO = 5 * 1024 * 1024;

class HttpError extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isId = (s) => typeof s === 'string' && /^[0-9a-f-]{36}$/.test(s);
const uid = () => crypto.randomUUID();
const todayUTC = () => new Date().toISOString().slice(0, 10);
const validYearDate = (s) => {
  const m = /^(\d{2})-(\d{2})$/.exec(String(s));
  return !!m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= new Date(Date.UTC(2024, +m[1], 0)).getUTCDate();
};

export { addInterval };

// ---------- Auth ----------
const sign = (p, secret) => crypto.createHmac('sha256', secret).update(p).digest('base64url');

function makeToken(userId, secret) {
  const p = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 180 })).toString('base64url');
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
    nextDue: todayUTC(), lastDone: null, photos: [],
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
  if (b.schedule !== undefined) t.schedule = SCHEDULES.includes(b.schedule) ? b.schedule : 'completion';
  if (b.weekdays !== undefined) {
    t.weekdays = [...new Set((Array.isArray(b.weekdays) ? b.weekdays : []).map(Number))].filter((d) => d >= 1 && d <= 7).sort();
  }
  if (b.monthDay !== undefined) {
    const md = parseInt(b.monthDay, 10);
    if (!(md === -1 || (md >= 1 && md <= 31))) throw new HttpError('Ungültiger Tag im Monat');
    t.monthDay = md;
  }
  if (b.yearDate !== undefined && b.yearDates === undefined) b.yearDates = [b.yearDate];
  if (b.yearDates !== undefined) {
    const list = [...new Set(Array.isArray(b.yearDates) ? b.yearDates : [])];
    if (list.some((d) => !validYearDate(d))) throw new HttpError('Ungültiges Datum (TT.MM.)');
    if (list.length > 24) throw new HttpError('Maximal 24 Daten pro Jahr');
    t.yearDates = list.sort();
    delete t.yearDate;
  }
  if (b.assignMode !== undefined) t.assignMode = ['none', 'fixed', 'rotate'].includes(b.assignMode) ? b.assignMode : 'none';
  const ids = db.users.map((u) => u.id);
  if (b.members !== undefined) t.members = (Array.isArray(b.members) ? b.members : []).filter((id) => ids.includes(id));
  if (b.assignee !== undefined) t.assignee = ids.includes(b.assignee) ? b.assignee : null;
  if (b.photos !== undefined) t.photos = (Array.isArray(b.photos) ? b.photos : []).filter(isId).slice(0, 12);
  if (b.nextDue !== undefined) {
    if (t.schedule === 'once' && (b.nextDue === null || b.nextDue === '')) t.nextDue = null;
    else if (!isDate(b.nextDue)) throw new HttpError('Ungültiges Datum');
    else t.nextDue = b.nextDue;
  }

  if (t.schedule === 'once') {
    delete t.anchor;
  } else {
    delete t.completedAt;
    if (!t.nextDue) t.nextDue = todayUTC();
  }
  if (t.schedule === 'calendar') {
    if (t.intervalUnit === 'day') throw new HttpError('Für „Bestimmter Tag“ Woche, Monat oder Jahr wählen');
    if (t.intervalValue > 99) throw new HttpError('Bei „Bestimmter Tag“ max. 99');
    const [, mm, dd] = t.nextDue.split('-');
    const dow = ((new Date(t.nextDue + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
    if (t.intervalUnit === 'week' && !t.weekdays?.length) t.weekdays = [dow];
    if (t.intervalUnit === 'month' && !t.monthDay) t.monthDay = +dd;
    if (t.intervalUnit === 'year') {
      t.yearDates = yearDatesOf(t);
      delete t.yearDate;
      if (!t.yearDates.length) t.yearDates = [`${mm}-${dd}`];
    }
    setupCalendar(t);
  }
  if (t.assignMode === 'none') t.assignee = null;
  if (t.assignMode === 'fixed' && !t.assignee) t.assignMode = 'none';
  if (t.assignMode === 'rotate') {
    if (!t.members.length) t.members = [...ids];
    if (!t.members.includes(t.assignee)) t.assignee = t.members[0] || null;
  }
  return t;
}

function rotate(task, db) {
  if (task.assignMode !== 'rotate') return;
  const pool = task.members.filter((id) => db.users.some((x) => x.id === id));
  if (pool.length) task.assignee = pool[(pool.indexOf(task.assignee) + 1) % pool.length];
}

const publicUser = (u) => ({ id: u.id, name: u.name, admin: !!u.admin, createdAt: u.createdAt });

function stateFor(db, me) {
  return {
    me: {
      ...publicUser(me),
      notify: me.notify ?? 'daily', notifyScope: me.notifyScope || 'mine', notifyHour: me.notifyHour ?? 7,
      notifyAssign: me.notifyAssign !== false, devices: (me.pushSubs || []).map((s) => s.endpoint),
    },
    users: db.users.map(publicUser),
    tasks: db.tasks,
    log: [...db.log].sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 500),
  };
}

const fmtDate = (ds) => (ds ? ds.split('-').reverse().join('.') : '');

// ---------- Handler ----------
export function createApi({ store, photoStore, push, teamCode, secret, trmnlKey }) {
  const load = async () => (await store.get('db', { type: 'json' })) || { users: [], tasks: [], log: [] };
  const save = (db) => store.setJSON('db', db);
  const dropPhotos = async (ids) => {
    if (!photoStore) return;
    await Promise.allSettled((ids || []).map((id) => photoStore.delete(id)));
  };

  return async function handler(req) {
    try {
      if (!secret) throw new HttpError('Server nicht konfiguriert: SESSION_SECRET fehlt', 500);
      const url = new URL(req.url);
      const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      const method = req.method;
      const authUser = (db) => {
        const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('t');
        const me = db.users.find((u) => u.id === readToken(tok, secret));
        if (!me) throw new HttpError('Nicht angemeldet', 401);
        return me;
      };

      // --- TRMNL-Display (eigener Schlüssel, nur lesend) ---
      if (parts[0] === 'trmnl' && method === 'GET') {
        if (!trmnlKey) throw new HttpError('TRMNL ist nicht eingerichtet (TRMNL_KEY fehlt)', 404);
        const given = url.searchParams.get('key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        const a = Buffer.from(String(given)), k = Buffer.from(trmnlKey);
        if (a.length !== k.length || !crypto.timingSafeEqual(a, k)) throw new HttpError('Falscher Schlüssel', 401);
        const res = json(trmnlData(await load(), url.searchParams));
        res.headers.set('cache-control', 'no-store');
        return res;
      }

      // --- Fotos (Binärdaten, eigener Pfad) ---
      if (parts[0] === 'photos') {
        const db = await load();
        authUser(db);
        if (method === 'POST' && !parts[1]) {
          const type = (req.headers.get('content-type') || '').split(';')[0];
          if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new HttpError('Nur JPEG, PNG oder WebP');
          const buf = await req.arrayBuffer();
          if (!buf.byteLength) throw new HttpError('Leeres Bild');
          if (buf.byteLength > MAX_PHOTO) throw new HttpError('Bild zu gross (max. 5 MB)');
          const id = uid();
          await photoStore.set(id, buf, { metadata: { type } });
          return json({ id });
        }
        if (method === 'GET' && isId(parts[1])) {
          const r = await photoStore.getWithMetadata(parts[1], { type: 'arrayBuffer' });
          if (!r) throw new HttpError('Foto nicht gefunden', 404);
          return new Response(r.data, {
            headers: { 'content-type': r.metadata?.type || 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' },
          });
        }
        throw new HttpError('Nicht gefunden', 404);
      }

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
        const user = {
          id: uid(), name, pw: hashPw(pw), admin: db.users.length === 0, createdAt: new Date().toISOString(),
          notify: 'daily', notifyScope: 'mine', notifyHour: 7, notifyAssign: true, pushSubs: [],
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
      if (parts[0] === 'push' && parts[1] === 'key' && method === 'GET') {
        if (!push) throw new HttpError('Push nicht verfügbar', 501);
        return json({ publicKey: await push.publicKey() });
      }

      // --- ab hier angemeldet ---
      const me = authUser(db);

      // Benachrichtigungen an andere sammeln und vor dem Speichern senden
      const notes = new Map(); // userId -> [{kind, title, due}]
      const notifyUser = (userId, kind, task) => {
        if (!userId || userId === me.id) return;
        (notes.get(userId) || notes.set(userId, []).get(userId)).push({ kind, title: task.title, due: task.nextDue });
      };
      const flushNotes = async () => {
        if (!push || !notes.size) return;
        await Promise.allSettled([...notes].map(async ([userId, items]) => {
          const u = db.users.find((x) => x.id === userId);
          if (!u || u.notifyAssign === false || !(u.pushSubs || []).length) return;
          const one = items.length === 1 ? items[0] : null;
          const payload = one
            ? { title: one.kind === 'turn' ? `Du bist dran: ${one.title}` : `Neue Aufgabe für dich: ${one.title}`,
                body: `${one.due ? `Fällig am ${fmtDate(one.due)}` : 'Ohne Termin'} · von ${me.name}`, url: '/', tag: 'assign' }
            : { title: `${items.length} Aufgaben neu für dich`, body: items.slice(0, 4).map((i) => i.title).join(', '), url: '/', tag: 'assign' };
          const r = await push.sendToUser(u, payload);
          pruneSubs(u, r.dead);
        }));
      };
      const done = async () => { await flushNotes(); await save(db); return json(stateFor(db, me)); };

      if (parts[0] === 'state' && method === 'GET') return json(stateFor(db, me));

      if (parts[0] === 'me' && method === 'PUT') {
        if (b.password !== undefined) {
          if (!checkPw(String(b.oldPassword || ''), me.pw)) throw new HttpError('Altes Passwort falsch', 403);
          if (String(b.password).length < 6) throw new HttpError('Passwort: mindestens 6 Zeichen');
          me.pw = hashPw(String(b.password));
        }
        if (b.notify !== undefined) me.notify = b.notify === 'off' ? 'off' : 'daily';
        if (b.notifyScope !== undefined) me.notifyScope = b.notifyScope === 'all' ? 'all' : 'mine';
        if (b.notifyAssign !== undefined) me.notifyAssign = b.notifyAssign === true || b.notifyAssign === 'on' || b.notifyAssign === 'true';
        if (b.notifyHour !== undefined) {
          const h = parseInt(b.notifyHour, 10);
          if (!(h >= 0 && h <= 23)) throw new HttpError('Ungültige Uhrzeit');
          me.notifyHour = h;
        }
        return done();
      }

      if (parts[0] === 'push') {
        const sub = b.subscription;
        if (parts[1] === 'subscribe' && method === 'POST') {
          if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError('Ungültiges Push-Abo');
          // ein Gerät gehört immer nur einer Person
          for (const u of db.users) u.pushSubs = (u.pushSubs || []).filter((s) => s.endpoint !== sub.endpoint);
          me.pushSubs = me.pushSubs || [];
          me.pushSubs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            device: String(b.device || '').slice(0, 80), createdAt: new Date().toISOString() });
          me.pushSubs = me.pushSubs.slice(-10);
          return done();
        }
        if (parts[1] === 'unsubscribe' && method === 'POST') {
          me.pushSubs = (me.pushSubs || []).filter((s) => s.endpoint !== b.endpoint);
          return done();
        }
        if (parts[1] === 'test' && method === 'POST') {
          if (!(me.pushSubs || []).length) throw new HttpError('Dieses Konto hat noch kein Gerät für Push aktiviert');
          const r = await push.sendToUser(me, { title: 'To-do-list 👋', body: 'Push-Nachrichten funktionieren.', url: '/', tag: 'test' });
          pruneSubs(me, r.dead);
          await save(db);
          if (!r.sent) throw new HttpError('Senden fehlgeschlagen – bitte Push auf diesem Gerät neu aktivieren', 502);
          return json({ sent: r.sent });
        }
      }

      if (parts[0] === 'users' && parts[1] && method === 'DELETE') {
        if (!me.admin) throw new HttpError('Nur Admins dürfen Mitglieder entfernen', 403);
        if (parts[1] === me.id) throw new HttpError('Du kannst dich nicht selbst entfernen');
        db.users = db.users.filter((u) => u.id !== parts[1]);
        for (const t of db.tasks) {
          t.members = (t.members || []).filter((id) => id !== parts[1]);
          if (t.assignee === parts[1]) t.assignee = t.assignMode === 'rotate' ? (t.members[0] || null) : null;
          if (!t.assignee && t.assignMode === 'fixed') t.assignMode = 'none';
        }
        return done();
      }

      if (parts[0] === 'tasks') {
        const id = parts[1];
        const created = (t) => { t.createdBy = me.id; t.createdAt = new Date().toISOString(); db.tasks.push(t); notifyUser(t.assignee, 'new', t); };
        if (!id && method === 'POST') { created(cleanTask(b, db)); return done(); }
        if (id === 'bulk' && method === 'POST') {
          for (const item of (Array.isArray(b.tasks) ? b.tasks.slice(0, 200) : [])) created(cleanTask(item, db));
          return done();
        }
        const task = db.tasks.find((t) => t.id === id);
        if (!task) throw new HttpError('Aufgabe nicht gefunden', 404);

        if (!parts[2] && method === 'PUT') {
          const before = { assignee: task.assignee, photos: task.photos || [] };
          Object.assign(task, cleanTask(b, db, task));
          if (task.assignee !== before.assignee) notifyUser(task.assignee, 'new', task);
          const removed = before.photos.filter((p) => !(task.photos || []).includes(p));
          await dropPhotos(removed);
          return done();
        }
        if (!parts[2] && method === 'DELETE') {
          const logs = db.log.filter((l) => l.taskId === id);
          await dropPhotos([...(task.photos || []), ...logs.flatMap((l) => l.photos || [])]);
          db.tasks = db.tasks.filter((t) => t.id !== id);
          db.log = db.log.filter((l) => l.taskId !== id);
          return done();
        }
        if ((parts[2] === 'done' || parts[2] === 'skip') && method === 'POST') {
          if (task.schedule === 'once' && parts[2] === 'skip') throw new HttpError('Einmalige Aufgaben können nicht übersprungen werden');
          if (task.completedAt) throw new HttpError('Aufgabe ist bereits erledigt');
          const date = isDate(b.date) ? b.date : todayUTC();
          const entry = {
            id: uid(), taskId: id, taskTitle: task.title, userId: me.id,
            type: parts[2], date, note: String(b.note || '').slice(0, 500), at: new Date().toISOString(),
            photos: (Array.isArray(b.photos) ? b.photos : []).filter(isId).slice(0, 12),
            prev: { nextDue: task.nextDue, lastDone: task.lastDone, assignee: task.assignee, completedAt: task.completedAt ?? null },
          };
          if (parts[2] === 'done') task.lastDone = !task.lastDone || date > task.lastDone ? date : task.lastDone;
          if (task.schedule === 'once') {
            task.completedAt = date;
          } else {
            task.nextDue = nextDueAfter(task, date);
            const prevAssignee = task.assignee;
            rotate(task, db);
            if (task.assignee !== prevAssignee) notifyUser(task.assignee, 'turn', task);
          }
          db.log.push(entry);
          return done();
        }
      }

      if (parts[0] === 'log' && parts[1] && method === 'DELETE') {
        const entry = db.log.find((l) => l.id === parts[1]);
        if (!entry) throw new HttpError('Eintrag nicht gefunden', 404);
        const task = db.tasks.find((t) => t.id === entry.taskId);
        const latest = db.log.filter((l) => l.taskId === entry.taskId).sort((a, b) => (b.at > a.at ? 1 : -1))[0];
        if (task && latest && latest.id === entry.id && entry.prev) {
          Object.assign(task, entry.prev);
          if (!task.completedAt) delete task.completedAt;
        }
        await dropPhotos(entry.photos);
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
