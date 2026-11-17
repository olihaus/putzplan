'use strict';

// ================= Vorlagen =================
// [Name, Intervall, Einheit] oder [Name, Kalender-Regel]
const TEMPLATES = {
  'Küche': [
    ['Kühlschrank reinigen', 1, 'month'], ['Backofen reinigen', 3, 'month'], ['Dunstabzug-Fettfilter reinigen', 1, 'month'],
    ['Kaffeemaschine entkalken', 1, 'month'], ['Geschirrspüler-Filter reinigen', 2, 'week'], ['Mikrowelle reinigen', 2, 'week'],
    ['Abfalleimer auswaschen', 1, 'month'], ['Wasserkocher entkalken', 1, 'month'], ['Spülbecken & Abfluss reinigen', 1, 'week'],
  ],
  'Bad': [
    ['Bad putzen', 1, 'week'], ['WC reinigen', 1, 'week'], ['Duschabfluss reinigen', 1, 'month'], ['Duschkopf entkalken', 3, 'month'],
    ['Handtücher wechseln', 1, 'week'], ['Duschvorhang waschen', 3, 'month'], ['Fugen reinigen', 6, 'month'],
  ],
  'Wohnen & Schlafen': [
    ['Staubsaugen', 1, 'week'], ['Böden feucht wischen', 2, 'week'], ['Staub wischen', 2, 'week'], ['Bettwäsche wechseln', 2, 'week'],
    ['Fenster putzen', 3, 'month'], ['Matratze wenden', 6, 'month'], ['Vorhänge waschen', 6, 'month'], ['Kissen & Duvet waschen', 6, 'month'],
  ],
  'Haushaltsgeräte': [
    ['Waschmaschine: Reinigungsprogramm 90°', 1, 'month'], ['Waschmaschine: Flusensieb reinigen', 3, 'month'],
    ['Tumbler: Flusensieb & Kondensator reinigen', 1, 'month'], ['Staubsauger-Filter reinigen', 3, 'month'],
    ['Wasserenthärter: Salz nachfüllen', 1, 'month'], ['Geschirrspüler: Salz & Klarspüler prüfen', 1, 'month'],
  ],
  'Haus & Technik': [
    ['Rauchmelder testen', 3, 'month'], ['Rauchmelder-Batterien wechseln', { yearDates: ['01-15'] }], ['Lüftungsfilter wechseln', 6, 'month'],
    ['Heizkörper entlüften', { yearDates: ['10-01'] }], ['Heizung: Wasserdruck prüfen', 3, 'month'], ['Feuerlöscher Sichtkontrolle', 1, 'year'],
    ['Silikonfugen kontrollieren', 1, 'year'], ['Abflüsse spülen (Hausanschluss)', 6, 'month'], ['PV-Anlage Sichtkontrolle', { yearDates: ['04-15'] }],
  ],
  'Aussen & Garten': [
    ['Dachrinnen reinigen', { yearDates: ['11-15'] }], ['Balkon / Terrasse reinigen', 1, 'month'], ['Rasen mähen', 1, 'week'],
    ['Gartenmöbel reinigen & einwintern', { yearDates: ['04-01', '10-15'] }], ['Storen / Lamellen reinigen', 1, 'year'],
    ['Briefkasten & Eingang reinigen', 1, 'month'],
  ],
  'Fahrzeuge': [
    ['Reifenwechsel', { yearDates: ['04-01', '10-15'] }], ['Reifendruck prüfen', 1, 'month'], ['Auto innen reinigen', 1, 'month'],
    ['Velo: Kette reinigen & ölen', 1, 'month'],
  ],
};

// ================= Helfer =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayNum = (ds) => { const [y, m, d] = ds.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const diffDays = (ds) => dayNum(ds) - dayNum(localToday());
const addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const fmtDate = (ds) => { if (!ds) return '–'; const [y, m, d] = ds.split('-'); return `${+d}.${+m}.${y}`; };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_S = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const UNIT_SEL = { day: 'Tage', week: 'Wochen', month: 'Monate', year: 'Jahre' };
const AV_COLORS = ['#2747d8', '#c2410c', '#0f8a6a', '#a21caf', '#b45309', '#0e7490', '#be123c'];
const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CAM = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const yearDatesOf = (t) => (t.yearDates?.length ? t.yearDates : t.yearDate ? [t.yearDate] : []);
const recOf = (t) => (t.schedule === 'calendar' ? { week: 'weekly', month: 'monthly', year: 'yearly' }[t.intervalUnit] : t.schedule || 'completion');
const isOpen = (t) => !t.completedAt;

function scheduleText(t) {
  const n = t.intervalValue, u = t.intervalUnit;
  const rec = recOf(t);
  if (rec === 'once') return 'einmalig';
  if (rec === 'weekly' || rec === 'monthly' || rec === 'yearly') {
    const every = n === 1 ? { week: 'jeden', month: 'monatlich am', year: 'jährlich am' }[u] : `alle ${n} ${UNIT_SEL[u]} am`;
    if (u === 'week') return `${every} ${(t.weekdays || []).map((d) => WD[d - 1]).join(', ')}`;
    if (u === 'month') return `${every} ${t.monthDay === -1 ? 'Monatsletzten' : t.monthDay + '.'}`;
    const ds = yearDatesOf(t).map((yd) => { const [m, d] = yd.split('-').map(Number); return `${d}. ${(yearDatesOf(t).length > 1 ? MONTHS_S : MONTHS)[m - 1]}`; });
    return `${every} ${ds.length > 1 ? ds.slice(0, -1).join(', ') + ' und ' + ds.at(-1) : ds[0]}`;
  }
  const base = n === 1 ? { day: 'täglich', week: 'wöchentlich', month: 'monatlich', year: 'jährlich' }[u] : `alle ${n} ${UNIT_SEL[u]}`;
  return rec === 'fixed' ? `${base}, fester Takt` : base;
}

function dueInfo(t) {
  if (t.completedAt) return { cls: '', text: `erledigt ${fmtDate(t.completedAt)}` };
  if (!t.nextDue) return { cls: '', text: 'ohne Termin' };
  const d = diffDays(t.nextDue);
  if (d < -1) return { cls: 'late', text: `seit ${-d} Tagen` };
  if (d === -1) return { cls: 'late', text: 'seit gestern' };
  if (d === 0) return { cls: 'today', text: 'heute' };
  if (d === 1) return { cls: '', text: 'morgen' };
  if (d < 7) return { cls: '', text: WD_LONG[new Date(t.nextDue + 'T12:00:00').getDay()] };
  return { cls: '', text: fmtDate(t.nextDue).replace(/\.\d{4}$/, d > 300 ? '.' + t.nextDue.slice(0, 4) : '.') };
}

const userById = (id) => S.users.find((u) => u.id === id);
const userName = (id) => userById(id)?.name || '–';
function avatar(id, big = false) {
  const i = S.users.findIndex((u) => u.id === id);
  if (i < 0) return `<span class="avatar none${big ? ' big' : ''}" aria-label="niemand">–</span>`;
  const u = S.users[i];
  return `<span class="avatar${big ? ' big' : ''}" style="--c:${AV_COLORS[i % AV_COLORS.length]}" title="${esc(u.name)}">${esc(u.name.slice(0, 1).toUpperCase())}</span>`;
}
const photoUrl = (id) => `/api/photos/${id}?t=${encodeURIComponent(token)}`;
const thumbsHtml = (ids, small = false) => (ids?.length
  ? `<div class="thumbs${small ? ' small' : ''}">${ids.map((p) => `<button type="button" class="thumb" data-act="photo" data-id="${p}"><img src="${photoUrl(p)}" alt="Foto" loading="lazy"></button>`).join('')}</div>` : '');

let toastTimer;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) $('button', t).onclick = () => { t.classList.remove('show'); clearTimeout(toastTimer); action.run(); };
  clearTimeout(toastTimer);
  // als Popover in der obersten Ebene, damit der Hinweis auch über offenen Dialogen sichtbar ist
  try { if (t.showPopover) { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } } catch { /* ältere Browser */ }
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { try { if (t.matches(':popover-open')) t.hidePopover(); } catch { /* ignore */ } }, 260);
  }, action ? 5000 : 2400);
}

// ================= API =================
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
let token = store.get('pp_token');
let S = { me: null, users: [], tasks: [], log: [] };
let view = 'heute';
let onlyMine = store.get('pp_mine') === '1';
let showDone = false;

async function api(path, method = 'GET', body, raw) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { ...(raw ? { 'content-type': raw.type } : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: raw ? raw : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && path !== 'login') { logout(true); throw new Error('Bitte erneut anmelden'); }
  if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
  return data;
}
async function mutate(path, method, body, msg) {
  try {
    S = await api(path, method, body);
    render();
    if (msg) toast(msg);
    return true;
  } catch (e) { toast(e.message); return false; }
}
async function refresh() {
  if (!token) return;
  try { S = await api('state'); render(); } catch (e) { toast(e.message); }
}

// ================= Anmeldung =================
let authMode = 'login';
function showAuth() { $('#auth').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); }
async function logout(expired = false) {
  if (!expired) {
    const sub = await currentSubscription().catch(() => null);
    if (sub) await api('push/unsubscribe', 'POST', { endpoint: sub.endpoint }).catch(() => {});
  }
  token = null; store.del('pp_token'); S = { me: null, users: [], tasks: [], log: [] }; showAuth();
}

$$('[data-auth]').forEach((b) => b.addEventListener('click', () => {
  authMode = b.dataset.auth;
  $$('[data-auth]').forEach((x) => x.classList.toggle('on', x === b));
  $$('.reg-only').forEach((x) => x.classList.toggle('hidden', authMode !== 'register'));
  $('#authSubmit').textContent = authMode === 'login' ? 'Anmelden' : 'Konto erstellen';
  $('#authForm [name=password]').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  $('#authError').textContent = '';
}));
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#authError').textContent = '';
  try {
    const r = await api(authMode, 'POST', Object.fromEntries(new FormData(e.target)));
    token = r.token; store.set('pp_token', token);
    e.target.reset(); showApp(); await refresh();
    if (authMode === 'register') setTimeout(openNotifyDialog, 400);
  } catch (err) { $('#authError').textContent = err.message; }
});

// ================= Navigation =================
const TITLES = { heute: null, liste: 'Alle Aufgaben', vorlagen: 'Vorlagen', verlauf: 'Verlauf', team: 'Team' };
function go(v) {
  view = v;
  $$('.tabbar button').forEach((x) => x.classList.toggle('on', x.dataset.view === v));
  render(); window.scrollTo(0, 0);
}
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('#meBtn').addEventListener('click', () => openMenu(S.me.name, [
  ['Benachrichtigungen', openNotifyDialog],
  ['Passwort ändern', openPasswordDialog],
  ['Abmelden', () => logout(), 'danger'],
]));

// ================= Darstellung =================
function render() {
  if (!S.me) return;
  const now = new Date();
  $('#topDate').textContent = view === 'heute' ? `${WD_LONG[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}` : 'To-do-list';
  $('#topTitle').textContent = TITLES[view] || `Hallo ${S.me.name}`;
  const meIdx = S.users.findIndex((u) => u.id === S.me.id);
  const mb = $('#meBtn');
  mb.textContent = S.me.name.slice(0, 1).toUpperCase();
  mb.style.setProperty('--c', AV_COLORS[meIdx % AV_COLORS.length]);
  $('.fab').classList.toggle('hidden', view === 'vorlagen' || view === 'team');
  $('#main').innerHTML = { heute: viewHeute, liste: viewListe, vorlagen: viewVorlagen, verlauf: viewVerlauf, team: viewTeam }[view]();
  updateBadge();
}

function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  const n = S.tasks.filter((t) => isOpen(t) && t.nextDue && diffDays(t.nextDue) <= 0 && (t.assignee === S.me.id || !t.assignee)).length;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

function row(t) {
  const di = dueInfo(t);
  const meta = [
    t.area ? `<span>${esc(t.area)}</span>` : '',
    `<span>${esc(scheduleText(t))}</span>`,
    t.photos?.length ? `<span class="cam">${ICON_CAM}${t.photos.length}</span>` : '',
  ].join('');
  return `<div class="row ${di.cls}${t.completedAt ? ' done-row' : ''}" data-act="open" data-id="${t.id}">
    <button type="button" class="tick${t.completedAt ? ' ticked' : ''}" data-act="tick" data-id="${t.id}" aria-label="${esc(t.title)} als erledigt markieren">${ICON_CHECK}</button>
    <div class="row-main"><div class="row-title">${esc(t.title)}</div><div class="row-meta">${meta}</div></div>
    <div class="row-side"><span class="due ${di.cls}">${di.text}</span>${t.assignee ? avatar(t.assignee) : ''}</div>
  </div>`;
}
const group = (title, list, cls = '') => (list.length
  ? `<h2 class="group-title ${cls}">${title}<small>${list.length}</small></h2><div class="sheet">${list.map(row).join('')}</div>` : '');
const byDue = (a, b) => ((a.nextDue || '9999') > (b.nextDue || '9999') ? 1 : -1);

function viewHeute() {
  if (!S.tasks.length) {
    return `<div class="empty"><h2>Noch nichts geplant</h2><p>Starte mit fertigen Vorlagen für Haushalt und Unterhalt oder erfasse eine eigene Aufgabe.</p>
      <div class="btns"><button class="btn primary" data-act="goto" data-view="vorlagen">Vorlagen ansehen</button><button class="btn" data-act="newtask">Aufgabe erfassen</button></div></div>`;
  }
  let tasks = S.tasks.filter(isOpen).sort(byDue);
  if (onlyMine) tasks = tasks.filter((t) => t.assignee === S.me.id || !t.assignee);
  const dated = tasks.filter((t) => t.nextDue);
  const over = dated.filter((t) => diffDays(t.nextDue) < 0);
  const today = dated.filter((t) => diffDays(t.nextDue) === 0);
  const week = dated.filter((t) => { const d = diffDays(t.nextDue); return d > 0 && d <= 7; });
  const later = dated.filter((t) => diffDays(t.nextDue) > 7);
  const undated = tasks.filter((t) => !t.nextDue);

  const parts = [];
  if (today.length) parts.push(`<b>${today.length} heute fällig</b>`);
  if (over.length) parts.push(`<b class="late">${over.length} überfällig</b>`);
  const summary = parts.length ? `${parts.join(', ')}.` : 'Für heute ist alles erledigt.';

  return `<p class="summary">${summary}</p>
    <div class="filterbar"><div class="seg" role="tablist">
      <button type="button" data-act="mine" data-v="0" class="${onlyMine ? '' : 'on'}">Alle</button>
      <button type="button" data-act="mine" data-v="1" class="${onlyMine ? 'on' : ''}">Für mich</button></div></div>
    ${group('Überfällig', over, 'late')}${group('Heute', today)}${group('Nächste 7 Tage', week)}${group('Ohne Termin', undated)}
    ${group('Später', later.slice(0, 20))}
    ${later.length > 20 ? `<p class="muted" style="margin:12px 6px">+${later.length - 20} weitere unter „Alle“</p>` : ''}`;
}

function viewListe() {
  const open = S.tasks.filter(isOpen);
  const doneOnce = S.tasks.filter((t) => t.completedAt).sort((a, b) => (b.completedAt > a.completedAt ? 1 : -1));
  const groups = {};
  for (const t of open) (groups[t.area || 'Ohne Bereich'] ||= []).push(t);
  const keys = Object.keys(groups).sort((a, b) => (a === 'Ohne Bereich') - (b === 'Ohne Bereich') || a.localeCompare(b, 'de'));
  return `${keys.map((k) => group(esc(k), groups[k].sort((a, b) => a.title.localeCompare(b.title, 'de')))).join('')
      || '<div class="empty"><h2>Keine offenen Aufgaben</h2><p>Mit dem Plus-Knopf erfasst du eine neue.</p></div>'}
    ${doneOnce.length ? `<h2 class="group-title">Erledigte einmalige Aufgaben<small>
      <button type="button" class="btn ghost small" data-act="toggleDone">${showDone ? 'Ausblenden' : `${doneOnce.length} anzeigen`}</button></small></h2>
      ${showDone ? `<div class="sheet">${doneOnce.map(row).join('')}</div>` : ''}` : ''}`;
}

function viewVorlagen() {
  const existing = new Set(S.tasks.map((t) => t.title.toLowerCase()));
  const unitSel = (u) => `<select data-f="unit" aria-label="Einheit">${Object.keys(UNIT_SEL).map((k) => `<option value="${k}" ${k === u ? 'selected' : ''}>${UNIT_SEL[k]}</option>`).join('')}</select>`;
  return `<div class="sheet card-pad"><h2>Aufgaben aus Vorlagen erstellen</h2>
      <p>Wähle aus, was bei euch anfällt, passe die Intervalle an und erstelle alles in einem Schritt.</p>
      <div class="stack" style="margin-top:14px">
        <label class="field">Zuständig<select id="tplAssign">
          <option value="rotate">Abwechselnd alle Mitglieder</option>
          <option value="none">Niemand fest – wer Zeit hat</option>
          ${S.users.map((u) => `<option value="u:${u.id}">${esc(u.name)}</option>`).join('')}
        </select></label>
        <label class="check"><input type="checkbox" id="tplSpread" checked> Termine verteilen, damit nicht alles am selben Tag fällig ist</label>
      </div></div>
    ${Object.entries(TEMPLATES).map(([cat, items]) => `<details class="sheet tpl-cat">
      <summary>${esc(cat)}</summary>
      ${items.map(([name, a, b]) => {
        const has = existing.has(name.toLowerCase());
        const cal = typeof a === 'object' ? a : null;
        const sub = has ? 'bereits vorhanden' : cal ? scheduleText({ schedule: 'calendar', intervalUnit: 'year', intervalValue: 1, yearDates: cal.yearDates }) : '';
        return `<label class="tpl" data-cat="${esc(cat)}" data-name="${esc(name)}" ${cal ? `data-cal='${esc(JSON.stringify(cal))}'` : ''}>
          <input type="checkbox" data-f="on" ${has ? 'disabled' : ''}>
          <span class="name">${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
          ${cal ? '' : `<input type="number" min="1" max="999" value="${a}" data-f="n" aria-label="Intervall">${unitSel(b)}`}</label>`;
      }).join('')}
    </details>`).join('')}
    <div class="sticky-cta"><button class="btn primary wide" data-act="tplAdd">Ausgewählte erstellen</button></div>`;
}

function viewVerlauf() {
  if (!S.log.length) return '<div class="empty"><h2>Noch nichts erledigt</h2><p>Hier erscheint, wer wann was gemacht hat – mit Notizen und Fotos.</p></div>';
  const byDate = {};
  for (const l of S.log) (byDate[l.date] ||= []).push(l);
  return Object.entries(byDate).map(([d, items]) => {
    const dd = diffDays(d);
    const label = dd === 0 ? 'Heute' : dd === -1 ? 'Gestern' : `${WD_LONG[new Date(d + 'T12:00:00').getDay()]}, ${fmtDate(d)}`;
    return `<h2 class="group-title">${label}</h2><div class="sheet">${items.map((l) => `<div class="log-row">
      ${avatar(l.userId)}
      <div class="row-main">
        <div><span class="row-title">${esc(l.taskTitle)}</span>${l.type === 'skip' ? ' <span class="muted">übersprungen</span>' : ''}</div>
        ${l.note ? `<div class="muted">${esc(l.note)}</div>` : ''}
        ${thumbsHtml(l.photos, true)}
      </div>
      <button type="button" class="undo" data-act="undo" data-id="${l.id}">Rückgängig</button></div>`).join('')}</div>`;
  }).join('');
}

function viewTeam() {
  const since = addDays(localToday(), -30);
  return `<div class="sheet card-pad"><h2>Jemanden einladen</h2>
      <p>Schick die Adresse dieser Seite und euren Team-Code. Neue Personen tippen auf „Konto erstellen“.</p></div>
    <h2 class="group-title">Mitglieder<small>${S.users.length}</small></h2>
    <div class="sheet">${S.users.map((u) => {
      const cnt = S.log.filter((l) => l.userId === u.id && l.type === 'done' && l.date >= since).length;
      const open = S.tasks.filter((t) => isOpen(t) && t.assignee === u.id).length;
      return `<div class="member">${avatar(u.id, true)}
        <div class="row-main"><b>${esc(u.name)}</b>${u.admin ? '<span class="tag">Admin</span>' : ''}${u.id === S.me.id ? '<span class="tag">Du</span>' : ''}
        <small>${cnt} erledigt in 30 Tagen, ${open} zugeteilt</small></div>
        ${S.me.admin && u.id !== S.me.id ? `<button class="btn danger small" data-act="deluser" data-id="${u.id}">Entfernen</button>` : ''}</div>`;
    }).join('')}</div>`;
}

// ================= Dialoge =================
const dlg = $('#dlg'), dlgForm = $('#dlgForm');
function openDialog(html, onSubmit, onReady) {
  dlgForm.innerHTML = html;
  dlgForm.onsubmit = async (e) => {
    e.preventDefault();
    const action = e.submitter?.value;
    if (action === 'cancel') return dlg.close();
    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      const ok = await onSubmit(new FormData(dlgForm), action);
      if (ok !== false) dlg.close();
    } finally { if (btn) btn.disabled = false; }
  };
  if (dlg.open) dlg.close();
  dlg.showModal();
  onReady?.();
}
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

function openMenu(title, items) {
  openDialog(`<h3 class="dlg-title">${esc(title)}</h3><div class="menu">
    ${items.map(([label, , cls], i) => `<button type="button" data-i="${i}" class="${cls || ''}">${esc(label)}</button>`).join('')}</div>`, () => {});
  $$('.menu button', dlgForm).forEach((b) => b.addEventListener('click', () => { dlg.close(); items[b.dataset.i][1](); }));
}

// --- Fotos: verkleinern & hochladen ---
async function shrink(file, max = 1600) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}

/** Bindet ein Fotofeld im offenen Dialog. Gibt {ids(), busy()} zurück. */
function photoField(el, initial = []) {
  const ids = [...initial];
  let pending = 0;
  const draw = () => {
    el.innerHTML = ids.map((p, i) => `<div class="thumb"><img src="${photoUrl(p)}" alt="Foto ${i + 1}"><button type="button" class="rm" data-i="${i}" aria-label="Foto entfernen">×</button></div>`).join('')
      + Array.from({ length: pending }, () => '<div class="thumb loading"></div>').join('')
      + `<label class="thumb add" aria-label="Foto hinzufügen">${ICON_CAM.replace('14', '26').replace('14', '26')}<input type="file" accept="image/*" multiple></label>`;
    $$('.rm', el).forEach((b) => b.onclick = () => { ids.splice(+b.dataset.i, 1); draw(); });
    $('input', el).onchange = async (e) => {
      const files = [...e.target.files].slice(0, 12 - ids.length);
      pending += files.length; draw();
      for (const f of files) {
        try {
          const blob = await shrink(f);
          const { id } = await api('photos', 'POST', null, blob);
          ids.push(id);
        } catch (err) { toast('Foto konnte nicht hochgeladen werden: ' + err.message); }
        pending--; draw();
      }
    };
  };
  draw();
  return { ids: () => [...ids], busy: () => pending > 0 };
}

function openViewer(id) {
  const v = $('#viewer');
  $('img', v).src = photoUrl(id);
  v.showModal();
}
$('#viewer').addEventListener('click', () => $('#viewer').close());

// --- Detailansicht ---
function openTaskSheet(t) {
  const di = dueInfo(t);
  const history = S.log.filter((l) => l.taskId === t.id).slice(0, 5);
  openDialog(`<h3 class="dlg-title">${esc(t.title)}</h3>
    <p class="dlg-sub">${esc(scheduleText(t))}${t.area ? ` – ${esc(t.area)}` : ''}</p>
    <dl class="facts">
      <dt>${t.completedAt ? 'Erledigt' : 'Fällig'}</dt><dd class="due ${di.cls}" style="font-size:inherit">${t.completedAt ? fmtDate(t.completedAt) : t.nextDue ? `${fmtDate(t.nextDue)} (${di.text})` : 'ohne Termin'}</dd>
      <dt>Zuständig</dt><dd>${t.assignee ? `${avatar(t.assignee)} ${esc(userName(t.assignee))}${t.assignMode === 'rotate' ? ' <span class="muted" style="font-weight:400">(abwechselnd)</span>' : ''}` : 'wer Zeit hat'}</dd>
      ${t.lastDone && !t.completedAt ? `<dt>Zuletzt</dt><dd>${fmtDate(t.lastDone)}</dd>` : ''}
    </dl>
    ${t.notes ? `<div class="note">${esc(t.notes)}</div>` : ''}
    ${thumbsHtml(t.photos)}
    ${history.length ? `<p class="section-label">Zuletzt erledigt</p><div class="sheet" style="box-shadow:none;background:var(--field)">${history.map((l) => `<div class="log-row">${avatar(l.userId)}
      <div class="row-main"><div>${fmtDate(l.date)}${l.type === 'skip' ? ' <span class="muted">übersprungen</span>' : ''}</div>${l.note ? `<div class="muted">${esc(l.note)}</div>` : ''}${thumbsHtml(l.photos, true)}</div></div>`).join('')}</div>` : ''}
    <div class="actions">
      ${t.completedAt ? '' : '<button class="btn primary" value="done">Erledigt …</button>'}
      ${!t.completedAt && t.schedule !== 'once' ? '<button class="btn" value="skip">Überspringen</button>' : ''}
      <span class="grow"></span><button class="btn ghost" value="edit">Bearbeiten</button>
    </div>`, (fd, action) => {
    if (action === 'done') setTimeout(() => openDoneDialog(t), 0);
    if (action === 'skip') setTimeout(() => openDoneDialog(t, 'skip'), 0);
    if (action === 'edit') setTimeout(() => openTaskDialog(t), 0);
  });
}

function openDoneDialog(t, type = 'done') {
  let photos;
  openDialog(`<h3 class="dlg-title">${type === 'done' ? 'Erledigt' : 'Diesmal überspringen'}</h3>
    <p class="dlg-sub">${esc(t.title)}</p>
    <div class="stack">
      <label class="field">Datum<input type="date" name="date" value="${localToday()}" max="${localToday()}" required></label>
      <label class="field">Notiz<input name="note" placeholder="${type === 'done' ? 'Zum Beispiel: Filter ersetzt' : 'Grund (optional)'}"></label>
      ${type === 'done' ? '<div class="field">Fotos<div class="thumbs" id="donePhotos"></div></div>' : ''}
    </div>
    <div class="actions"><button class="btn" value="cancel" formnovalidate>Abbrechen</button><span class="grow"></span>
      <button class="btn primary" value="save">${type === 'done' ? 'Als erledigt speichern' : 'Überspringen'}</button></div>`,
  async (fd) => {
    if (photos?.busy()) { toast('Fotos werden noch hochgeladen'); return false; }
    const body = Object.fromEntries(fd);
    if (photos) body.photos = photos.ids();
    return mutate(`tasks/${t.id}/${type}`, 'POST', body, type === 'done' ? 'Als erledigt gespeichert' : 'Übersprungen');
  }, () => { if (type === 'done') photos = photoField($('#donePhotos'), []); });
}

async function quickDone(t, btn) {
  const rowEl = btn.closest('.row');
  btn.classList.add('ticked');
  rowEl.classList.add('leaving');
  try {
    S = await api(`tasks/${t.id}/done`, 'POST', { date: localToday() });
    const entry = S.log.find((l) => l.taskId === t.id && l.userId === S.me.id);
    setTimeout(render, 550);
    toast(`„${t.title}“ erledigt`, entry ? { label: 'Rückgängig', run: () => mutate(`log/${entry.id}`, 'DELETE', null, 'Rückgängig gemacht') } : null);
  } catch (e) { btn.classList.remove('ticked'); rowEl.classList.remove('leaving'); toast(e.message); }
}

// --- Aufgabe erfassen / bearbeiten ---
const REC_LABEL = {
  once: 'Einmalig',
  completion: 'Wiederholen – ab Erledigung',
  fixed: 'Wiederholen – fester Takt',
  weekly: 'Jede Woche an bestimmten Tagen',
  monthly: 'Jeden Monat an einem Tag',
  yearly: 'Jedes Jahr an festen Daten',
};

function openTaskDialog(t = null) {
  const v = t || {
    title: '', area: '', notes: '', intervalValue: 1, intervalUnit: 'week', schedule: 'once', assignMode: 'none',
    assignee: null, members: S.users.map((u) => u.id), nextDue: '', photos: [],
  };
  const rec = recOf(v);
  const base = v.nextDue || localToday();
  const [, mm, dd] = base.split('-');
  const dow = ((new Date(base + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
  const yds = yearDatesOf(v).length ? yearDatesOf(v) : [`${mm}-${dd}`];
  const areas = [...new Set([...S.tasks.map((x) => x.area).filter(Boolean), ...Object.keys(TEMPLATES)])];
  const dayOpts = (sel) => Array.from({ length: 31 }, (_, i) => `<option ${sel === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
  const monOpts = (sel) => MONTHS.map((m, i) => `<option value="${i + 1}" ${sel === i + 1 ? 'selected' : ''}>${m}</option>`).join('');
  const dateRow = (yd) => { const [m, d] = yd.split('-').map(Number); return `<div class="daterow"><select name="yDay" aria-label="Tag">${dayOpts(d)}</select><select name="yMonth" aria-label="Monat">${monOpts(m)}</select><button type="button" data-rm aria-label="Datum entfernen">×</button></div>`; };
  let photos;

  openDialog(`<h3 class="dlg-title">${t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>
    <div class="stack" style="margin-top:14px">
      <label class="field">Was ist zu tun?<input name="title" value="${esc(v.title)}" required maxlength="120" placeholder="Zum Beispiel: Backofen reinigen"></label>
      <label class="field">Wiederholung<select name="rec" id="rec">${Object.entries(REC_LABEL).map(([k, l]) => `<option value="${k}" ${k === rec ? 'selected' : ''}>${l}</option>`).join('')}</select></label>

      <div class="field" id="fEvery">Alle
        <div class="inline"><input type="number" name="intervalValue" min="1" max="999" value="${v.intervalValue}" aria-label="Anzahl">
          <select name="intervalUnit" id="unitSel" aria-label="Einheit">${Object.entries(UNIT_SEL).map(([k, l]) => `<option value="${k}" ${k === v.intervalUnit ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span id="unitTxt" class="muted"></span></div></div>

      <div class="field" id="fWeek">An diesen Tagen<div class="chips">
        ${WD.map((w, i) => `<label class="chip-toggle"><input type="checkbox" name="weekdays" value="${i + 1}" ${(v.weekdays || [dow]).includes(i + 1) ? 'checked' : ''}><span>${w}</span></label>`).join('')}</div></div>

      <label class="field" id="fMonth">Tag im Monat<select name="monthDay">
        ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${(v.monthDay ?? +dd) === i + 1 ? 'selected' : ''}>${i + 1}.${i >= 28 ? ' (in kürzeren Monaten am Monatsletzten)' : ''}</option>`).join('')}
        <option value="-1" ${v.monthDay === -1 ? 'selected' : ''}>Letzter Tag des Monats</option></select></label>

      <div class="field" id="fYear">Daten im Jahr<div class="datelist" id="dateList">${yds.map(dateRow).join('')}</div>
        <button type="button" class="btn ghost small" id="addDate" style="justify-self:start">+ Weiteres Datum</button></div>

      <label class="field"><span id="dueLabel"></span><input type="date" name="nextDue" value="${v.nextDue || ''}"></label>

      <label class="field">Bereich<input name="area" value="${esc(v.area)}" list="areaList" placeholder="Zum Beispiel: Küche"></label>
      <datalist id="areaList">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>

      <label class="field">Zuständig<select name="assignMode" id="assignMode">
        <option value="none" ${v.assignMode === 'none' ? 'selected' : ''}>Niemand fest – wer Zeit hat</option>
        <option value="fixed" ${v.assignMode === 'fixed' ? 'selected' : ''}>Eine bestimmte Person</option>
        <option value="rotate" ${v.assignMode === 'rotate' ? 'selected' : ''}>Abwechselnd</option></select></label>
      <label class="field" id="assigneeWrap"><span id="assigneeLabel">Person</span><select name="assignee">${S.users.map((u) => `<option value="${u.id}" ${u.id === (v.assignee || S.me.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
      <div class="field" id="membersWrap">Abwechselnd zwischen<div class="chips">
        ${S.users.map((u) => `<label class="chip-toggle"><input type="checkbox" name="members" value="${u.id}" ${(v.members?.length ? v.members : S.users.map((x) => x.id)).includes(u.id) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`).join('')}</div></div>

      <label class="field">Notizen<textarea name="notes" placeholder="Anleitung, Material, Masse …">${esc(v.notes)}</textarea></label>
      <div class="field">Fotos<div class="thumbs" id="taskPhotos"></div></div>
    </div>
    <div class="actions">${t ? '<button class="btn danger" value="delete" formnovalidate>Löschen</button>' : '<button class="btn" value="cancel" formnovalidate>Abbrechen</button>'}
      <span class="grow"></span><button class="btn primary" value="save">Speichern</button></div>`,
  async (fd, action) => {
    if (action === 'delete') {
      if (!confirm(`„${t.title}“ mit Verlauf und Fotos löschen?`)) return false;
      return mutate(`tasks/${t.id}`, 'DELETE', null, 'Gelöscht');
    }
    if (photos.busy()) { toast('Fotos werden noch hochgeladen'); return false; }
    const r = fd.get('rec');
    const body = {
      title: fd.get('title'), area: fd.get('area'), notes: fd.get('notes'),
      assignMode: fd.get('assignMode'), assignee: fd.get('assignee'), members: fd.getAll('members'),
      intervalValue: Number(fd.get('intervalValue')) || 1, photos: photos.ids(),
      schedule: ['weekly', 'monthly', 'yearly'].includes(r) ? 'calendar' : r,
      intervalUnit: { weekly: 'week', monthly: 'month', yearly: 'year' }[r] || fd.get('intervalUnit'),
      nextDue: fd.get('nextDue') || (r === 'once' ? '' : localToday()),
    };
    if (r === 'weekly') {
      body.weekdays = fd.getAll('weekdays').map(Number);
      if (!body.weekdays.length) { toast('Mindestens einen Wochentag wählen'); return false; }
    }
    if (r === 'monthly') body.monthDay = Number(fd.get('monthDay'));
    if (r === 'yearly') {
      const days = fd.getAll('yDay'), mons = fd.getAll('yMonth');
      body.yearDates = days.map((d, i) => `${pad(mons[i])}-${pad(d)}`);
      for (const yd of body.yearDates) {
        const [m, d] = yd.split('-').map(Number);
        if (d > new Date(Date.UTC(2024, m, 0)).getUTCDate()) { toast(`Den ${d}. ${MONTHS[m - 1]} gibt es nicht`); return false; }
      }
      if (!body.yearDates.length) { toast('Mindestens ein Datum angeben'); return false; }
    }
    if (body.assignMode === 'rotate' && !body.members.length) { toast('Mindestens eine Person für das Abwechseln wählen'); return false; }
    return t ? mutate(`tasks/${t.id}`, 'PUT', body, 'Gespeichert') : mutate('tasks', 'POST', body, 'Aufgabe erstellt');
  }, () => {
    photos = photoField($('#taskPhotos'), v.photos || []);
    const recSel = $('#rec'), unitSel = $('#unitSel');
    const sync = () => {
      const r = recSel.value;
      const cal = { weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' }[r];
      $('#fEvery').classList.toggle('hidden', r === 'once');
      unitSel.classList.toggle('hidden', !!cal);
      $('#unitTxt').textContent = cal || '';
      $('#fWeek').classList.toggle('hidden', r !== 'weekly');
      $('#fMonth').classList.toggle('hidden', r !== 'monthly');
      $('#fYear').classList.toggle('hidden', r !== 'yearly');
      $('#dueLabel').textContent = r === 'once' ? 'Datum (leer lassen für „ohne Termin“)' : cal ? 'Beginnen ab' : 'Nächstes Mal fällig';
      const m = $('#assignMode').value;
      $('#assigneeWrap').classList.toggle('hidden', m === 'none');
      $('#membersWrap').classList.toggle('hidden', m !== 'rotate');
      $('#assigneeLabel').textContent = m === 'rotate' ? 'Als Nächstes dran' : 'Person';
    };
    recSel.onchange = sync; $('#assignMode').onchange = sync; sync();
    const list = $('#dateList');
    const bindRm = () => $$('[data-rm]', list).forEach((b) => b.onclick = () => { if ($$('.daterow', list).length > 1) b.parentElement.remove(); });
    $('#addDate').onclick = () => { list.insertAdjacentHTML('beforeend', dateRow(`${mm}-${dd}`)); bindRm(); };
    bindRm();
  });
}

function openPasswordDialog() {
  openDialog(`<h3 class="dlg-title">Passwort ändern</h3>
    <div class="stack" style="margin-top:14px">
      <label class="field">Bisheriges Passwort<input type="password" name="oldPassword" required autocomplete="current-password"></label>
      <label class="field">Neues Passwort<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
    </div>
    <div class="actions"><button class="btn" value="cancel" formnovalidate>Abbrechen</button><span class="grow"></span><button class="btn primary">Passwort ändern</button></div>`,
  (fd) => mutate('me', 'PUT', Object.fromEntries(fd), 'Passwort geändert'));
}

// ================= Push =================
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function deviceName() {
  const ua = navigator.userAgent;
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (isIOS && !/iPhone/.test(ua)) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Gerät';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return isStandalone() ? `${dev} (App)` : `${dev} ${br}`.trim();
}
async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
const b64ToBytes = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

async function enablePush() {
  if (!pushSupported()) throw new Error(isIOS ? 'Zuerst über „Teilen → Zum Home-Bildschirm“ installieren und von dort öffnen.' : 'Dieser Browser unterstützt keine Push-Nachrichten.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Mitteilungen sind blockiert. Erlaube sie in den Einstellungen des Geräts.');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await api('push/key');
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey) {
    const cur = new Uint8Array(sub.options.applicationServerKey);
    const want = b64ToBytes(publicKey);
    if (cur.length !== want.length || cur.some((x, i) => x !== want[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  S = await api('push/subscribe', 'POST', { subscription: sub.toJSON(), device: deviceName() });
}
async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    S = await api('push/unsubscribe', 'POST', { endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
  }
}

async function openNotifyDialog() {
  const m = S.me;
  const sub = await currentSubscription().catch(() => null);
  const active = !!sub && m.devices.includes(sub.endpoint);
  const others = m.devices.filter((e) => e !== sub?.endpoint).length;
  const needsInstall = isIOS && !isStandalone();
  openDialog(`<h3 class="dlg-title">Benachrichtigungen</h3>
    <p class="dlg-sub">Push-Nachrichten kommen direkt aufs Gerät – auch wenn die App geschlossen ist.</p>
    ${needsInstall ? `<div class="hint warn"><b>Auf dem iPhone zuerst installieren:</b> In Safari unten auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Die App vom Home-Bildschirm öffnen und hier Push aktivieren.</div>` : ''}
    <div class="status"><div><b>${active ? 'Auf diesem Gerät aktiv' : 'Auf diesem Gerät aus'}</b>
      <small>${others ? `Ausserdem auf ${others} weiteren Gerät${others > 1 ? 'en' : ''} aktiv` : active ? deviceName() : 'Noch nicht eingerichtet'}</small></div>
      <button type="button" class="btn ${active ? '' : 'primary'} small" id="pushToggle" ${needsInstall ? 'disabled' : ''}>${active ? 'Ausschalten' : 'Einschalten'}</button></div>
    <div class="stack" style="margin-top:18px">
      <label class="check"><input type="checkbox" name="digest" ${m.notify !== 'off' ? 'checked' : ''}> Tägliche Übersicht, wenn etwas fällig ist</label>
      <div class="cols">
        <label class="field">Um<select name="notifyHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === m.notifyHour ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
        <label class="field">Für<select name="notifyScope">
          <option value="mine" ${m.notifyScope !== 'all' ? 'selected' : ''}>Meine & offene</option>
          <option value="all" ${m.notifyScope === 'all' ? 'selected' : ''}>Alle Aufgaben</option></select></label>
      </div>
      <label class="check"><input type="checkbox" name="assign" ${m.notifyAssign ? 'checked' : ''}> Melden, wenn mir jemand eine Aufgabe zuteilt oder ich an der Reihe bin</label>
    </div>
    <div class="actions"><button class="btn" value="test" ${m.devices.length ? '' : 'disabled'}>Test senden</button><span class="grow"></span>
      <button class="btn primary" value="save">Speichern</button></div>`,
  async (fd, action) => {
    const ok = await mutate('me', 'PUT', {
      notify: fd.get('digest') ? 'daily' : 'off', notifyHour: fd.get('notifyHour'), notifyScope: fd.get('notifyScope'),
      notifyAssign: !!fd.get('assign'),
    }, action === 'test' ? null : 'Gespeichert');
    if (!ok) return false;
    if (action === 'test') {
      try { const r = await api('push/test', 'POST', {}); toast(`Test an ${r.sent} Gerät${r.sent > 1 ? 'e' : ''} gesendet`); }
      catch (e) { toast(e.message); }
      return false;
    }
  }, () => {
    $('#pushToggle').onclick = async (e) => {
      e.target.disabled = true;
      try {
        if (active) { await disablePush(); toast('Push auf diesem Gerät ausgeschaltet'); } else { await enablePush(); toast('Push auf diesem Gerät eingeschaltet'); }
        render(); openNotifyDialog();
      } catch (err) { toast(err.message); e.target.disabled = false; }
    };
  });
}

// ================= Ereignisse =================
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('dialog') && !['photo'].includes(el.dataset.act)) return;
  const act = el.dataset.act, id = el.dataset.id;
  const task = S.tasks.find((t) => t.id === id);
  if (act === 'tick' && task) { e.stopPropagation(); if (task.completedAt) openTaskSheet(task); else quickDone(task, el); return; }
  if (act === 'open' && task) openTaskSheet(task);
  if (act === 'photo') openViewer(id);
  if (act === 'newtask') openTaskDialog();
  if (act === 'goto') go(el.dataset.view);
  if (act === 'mine') { onlyMine = el.dataset.v === '1'; store.set('pp_mine', onlyMine ? '1' : '0'); render(); }
  if (act === 'toggleDone') { showDone = !showDone; render(); }
  if (act === 'undo') {
    if (confirm('Diesen Eintrag rückgängig machen? Beim letzten Eintrag einer Aufgabe wird auch der Termin zurückgesetzt.')) mutate(`log/${id}`, 'DELETE', null, 'Rückgängig gemacht');
  }
  if (act === 'deluser') {
    if (confirm(`${userName(id)} aus dem Team entfernen?`)) mutate(`users/${id}`, 'DELETE', null, 'Entfernt');
  }
  if (act === 'tplAdd') {
    const assign = $('#tplAssign').value, spread = $('#tplSpread').checked;
    const rows = $$('.tpl').filter((r) => $('[data-f=on]', r).checked);
    if (!rows.length) return toast('Wähle mindestens eine Vorlage aus');
    const assignment = {
      assignMode: assign === 'rotate' ? 'rotate' : assign === 'none' ? 'none' : 'fixed',
      assignee: assign.startsWith('u:') ? assign.slice(2) : null,
      members: S.users.map((x) => x.id),
    };
    const tasks = rows.map((r, i) => {
      const base = { title: r.dataset.name, area: r.dataset.cat, ...assignment };
      if (r.dataset.cal) return { ...base, schedule: 'calendar', intervalUnit: 'year', intervalValue: 1, ...JSON.parse(r.dataset.cal), nextDue: localToday() };
      const n = Number($('[data-f=n]', r).value) || 1, u = $('[data-f=unit]', r).value;
      const span = Math.min(n * UNIT_DAYS[u], 28);
      const offset = spread ? Math.floor((((i * 7919) % 97) / 97) * span) : 0;
      return { ...base, schedule: 'completion', intervalValue: n, intervalUnit: u, nextDue: addDays(localToday(), offset) };
    });
    if (await mutate('tasks/bulk', 'POST', { tasks }, `${tasks.length} Aufgaben erstellt`)) go('heute');
  }
});

// ================= Start =================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'refresh') refresh(); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden && !dlg.open) refresh(); }, 60000);
if (token) { showApp(); refresh(); } else showAuth();
