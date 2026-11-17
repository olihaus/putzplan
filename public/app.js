'use strict';

// ================= Vorlagen =================
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
    ['Rauchmelder testen', 3, 'month'], ['Rauchmelder-Batterien wechseln', 1, 'year'], ['Lüftungsfilter wechseln', 6, 'month'],
    ['Heizkörper entlüften', 1, 'year'], ['Heizung: Wasserdruck prüfen', 3, 'month'], ['Feuerlöscher Sichtkontrolle', 1, 'year'],
    ['Silikonfugen kontrollieren', 1, 'year'], ['Abflüsse spülen (Hausanschluss)', 6, 'month'], ['PV-Anlage Sichtkontrolle', 1, 'year'],
  ],
  'Aussen & Garten': [
    ['Dachrinnen reinigen', 1, 'year'], ['Balkon / Terrasse reinigen', 1, 'month'], ['Rasen mähen', 1, 'week'],
    ['Gartenmöbel reinigen', 6, 'month'], ['Storen / Lamellen reinigen', 1, 'year'], ['Briefkasten & Eingang reinigen', 1, 'month'],
  ],
  'Fahrzeuge': [
    ['Reifendruck prüfen', 1, 'month'], ['Auto innen reinigen', 1, 'month'], ['Velo: Kette reinigen & ölen', 1, 'month'],
    ['Reifenwechsel', 6, 'month'],
  ],
};

// ================= Helpers =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayNum = (ds) => { const [y, m, d] = ds.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const diffDays = (ds) => dayNum(ds) - dayNum(localToday());
const addDays = (ds, n) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const fmtDate = (ds) => { if (!ds) return '–'; const [y, m, d] = ds.split('-'); return `${d}.${m}.${y}`; };
const UNIT_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const UNIT_LABEL = { day: 'Tag(e)', week: 'Woche(n)', month: 'Monat(e)', year: 'Jahr(e)' };

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function intervalText(t) {
  const n = t.intervalValue, u = t.intervalUnit;
  if (t.schedule === 'calendar') {
    const every = n === 1 ? { week: 'jeden', month: 'monatlich am', year: 'jährlich am' }[u]
      : `alle ${n} ${{ week: 'Wochen', month: 'Monate', year: 'Jahre' }[u]} am`;
    if (u === 'week') return `${every} ${(t.weekdays || []).map((d) => WD[d - 1]).join(', ')}`;
    if (u === 'month') return `${every} ${t.monthDay === -1 ? 'letzten Tag' : t.monthDay + '.'}`;
    if (u === 'year') { const [m, d] = (t.yearDate || '01-01').split('-').map(Number); return `${every} ${d}. ${MONTHS[m - 1]}`; }
  }
  if (n === 1) return { day: 'täglich', week: 'wöchentlich', month: 'monatlich', year: 'jährlich' }[u];
  return `alle ${n} ${{ day: 'Tage', week: 'Wochen', month: 'Monate', year: 'Jahre' }[u]}`;
}
function dueInfo(t) {
  const d = diffDays(t.nextDue);
  if (d < 0) return { cls: 'overdue', badge: 'red', text: `${-d} ${-d === 1 ? 'Tag' : 'Tage'} überfällig` };
  if (d === 0) return { cls: 'today', badge: 'amber', text: 'heute fällig' };
  if (d === 1) return { cls: '', badge: '', text: 'morgen' };
  return { cls: '', badge: '', text: `in ${d} Tagen` };
}
const userName = (id) => S.users.find((u) => u.id === id)?.name || '–';

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ================= API =================
let token = localStorage.getItem('pp_token');
let S = { me: null, users: [], tasks: [], log: [] };
let view = 'heute';
let onlyMine = localStorage.getItem('pp_mine') === '1';

async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); throw new Error('Sitzung abgelaufen'); }
  if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
  return data;
}
async function mutate(path, method, body, msg) {
  try {
    S = await api(path, method, body);
    render();
    if (msg) toast(msg);
    return true;
  } catch (e) { toast('⚠️ ' + e.message); return false; }
}
async function refresh() {
  if (!token) return;
  try { S = await api('state'); render(); } catch (e) { toast('⚠️ ' + e.message); }
}

// ================= Auth =================
let authMode = 'login';
function showAuth() { $('#auth').classList.remove('hidden'); $('#app').classList.add('hidden'); }
function showApp() { $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function logout() { token = null; localStorage.removeItem('pp_token'); showAuth(); }

$$('[data-auth]').forEach((b) => b.addEventListener('click', () => {
  authMode = b.dataset.auth;
  $$('[data-auth]').forEach((x) => x.classList.toggle('active', x === b));
  $$('.reg-only').forEach((x) => x.classList.toggle('hidden', authMode !== 'register'));
  $('#authSubmit').textContent = authMode === 'login' ? 'Anmelden' : 'Konto erstellen';
  $('#authForm [name=password]').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  $('#authError').textContent = '';
}));
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  $('#authError').textContent = '';
  try {
    const r = await api(authMode, 'POST', f);
    token = r.token; localStorage.setItem('pp_token', token);
    e.target.reset(); showApp(); await refresh();
  } catch (err) { $('#authError').textContent = err.message; }
});

// ================= Navigation =================
$$('.bottomnav button').forEach((b) => b.addEventListener('click', () => {
  view = b.dataset.view;
  $$('.bottomnav button').forEach((x) => x.classList.toggle('active', x === b));
  render(); window.scrollTo(0, 0);
}));
$('#userBtn').addEventListener('click', () => openMenu([
  ['🔔 Erinnerungen per E-Mail', openNotifyDialog],
  ['🔑 Passwort ändern', openPasswordDialog],
  ['🚪 Abmelden', logout, 'danger'],
], S.me?.name));

// ================= Render =================
function render() {
  if (!S.me) return;
  $('#userBtn').textContent = '👤 ' + S.me.name;
  const main = $('#main');
  main.innerHTML = ({ heute: viewHeute, aufgaben: viewAufgaben, vorlagen: viewVorlagen, verlauf: viewVerlauf, team: viewTeam }[view])();
}

function taskCard(t, withCheck = true) {
  const di = dueInfo(t);
  const mine = t.assignee === S.me.id;
  return `<div class="card ${di.cls}">
    <div class="body">
      <div class="title">${esc(t.title)}</div>
      <div class="meta">
        <span class="badge ${di.badge}">${di.text}</span>
        ${t.area ? `<span>📍 ${esc(t.area)}</span>` : ''}
        <span>🔁 ${intervalText(t)}${t.assignMode === 'rotate' ? ' · Rotation' : ''}</span>
        ${t.assignee ? `<span class="badge ${mine ? 'me' : ''}">👤 ${esc(userName(t.assignee))}</span>` : ''}
      </div>
    </div>
    <button class="more" data-act="taskmenu" data-id="${t.id}" aria-label="Optionen">⋯</button>
    ${withCheck ? `<button class="check" data-act="done" data-id="${t.id}" aria-label="Erledigt">✓</button>` : ''}
  </div>`;
}

function viewHeute() {
  let tasks = [...S.tasks].sort((a, b) => (a.nextDue > b.nextDue ? 1 : -1));
  if (onlyMine) tasks = tasks.filter((t) => t.assignee === S.me.id || !t.assignee);
  const over = tasks.filter((t) => diffDays(t.nextDue) < 0);
  const today = tasks.filter((t) => diffDays(t.nextDue) === 0);
  const week = tasks.filter((t) => { const d = diffDays(t.nextDue); return d > 0 && d <= 7; });
  const later = tasks.filter((t) => diffDays(t.nextDue) > 7).slice(0, 15);
  const since = addDays(localToday(), -7);
  const doneWeek = S.log.filter((l) => l.type === 'done' && l.date >= since).length;

  if (!S.tasks.length) return `<div class="empty"><p>Noch keine Aufgaben.</p>
    <button class="btn primary" data-act="goto" data-view="vorlagen">✨ Aufgaben aus Vorlagen generieren</button>
    <p><button class="btn" data-act="newtask">+ Eigene Aufgabe</button></p></div>`;

  const sec = (title, list) => list.length ? `<h2>${title} (${list.length})</h2>${list.map((t) => taskCard(t)).join('')}` : '';
  return `
    <div class="stats">
      <div class="stat red"><b>${over.length}</b><span class="muted">überfällig</span></div>
      <div class="stat amber"><b>${today.length}</b><span class="muted">heute</span></div>
      <div class="stat green"><b>${doneWeek}</b><span class="muted">erledigt</span></div>
    </div>
    <div class="toolbar">
      <label class="toggle"><input type="checkbox" data-act="mine" ${onlyMine ? 'checked' : ''}> Nur meine & offene</label>
      <button class="btn small primary" data-act="newtask">+ Aufgabe</button>
    </div>
    ${sec('Überfällig', over)}${sec('Heute', today)}${sec('Nächste 7 Tage', week)}${sec('Später', later)}
    ${!over.length && !today.length ? '<p class="empty">🎉 Alles erledigt für heute!</p>' : ''}`;
}

function viewAufgaben() {
  const groups = {};
  for (const t of S.tasks) (groups[t.area || 'Ohne Bereich'] ||= []).push(t);
  const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'de'));
  return `<div class="toolbar"><span class="muted">${S.tasks.length} Aufgaben</span>
      <button class="btn small primary" data-act="newtask">+ Neue Aufgabe</button></div>
    ${keys.map((k) => `<h2>${esc(k)}</h2>${groups[k].sort((a, b) => a.title.localeCompare(b.title, 'de'))
      .map((t) => `<div class="list-row" data-act="edit" data-id="${t.id}">
        <div><div><b>${esc(t.title)}</b></div>
        <div class="sub">${intervalText(t)} · nächste: ${fmtDate(t.nextDue)} · zuletzt: ${fmtDate(t.lastDone)}${t.assignee ? ' · ' + esc(userName(t.assignee)) : ''}</div></div>
        <span class="muted">›</span></div>`).join('')}`).join('')
    || '<p class="empty">Noch keine Aufgaben.</p>'}`;
}

function viewVorlagen() {
  const existing = new Set(S.tasks.map((t) => t.title.toLowerCase()));
  const unitSel = (u) => `<select data-f="unit">${Object.keys(UNIT_LABEL).map((k) => `<option value="${k}" ${k === u ? 'selected' : ''}>${UNIT_LABEL[k]}</option>`).join('')}</select>`;
  return `<div class="panel">
      <b>Aufgaben generieren</b>
      <p class="muted" style="margin:4px 0 12px;font-size:.9rem">Wähle Vorlagen, passe Intervalle an und füge sie in einem Schritt hinzu.</p>
      <label>Zuweisung<select id="tplAssign">
        <option value="rotate">Rotation (alle Mitglieder abwechselnd)</option>
        <option value="none">Niemand (wer Zeit hat)</option>
        ${S.users.map((u) => `<option value="u:${u.id}">Fest: ${esc(u.name)}</option>`).join('')}
      </select></label>
      <label class="toggle"><input type="checkbox" id="tplSpread" checked> Fälligkeiten verteilen (nicht alles am selben Tag)</label>
    </div>
    ${Object.entries(TEMPLATES).map(([cat, items]) => `<details class="tpl-group" open>
      <summary>${esc(cat)} <span class="muted">${items.length}</span></summary>
      ${items.map(([name, n, u]) => {
        const has = existing.has(name.toLowerCase());
        return `<div class="tpl-item" data-cat="${esc(cat)}" data-name="${esc(name)}">
          <input type="checkbox" data-f="on" ${has ? 'disabled' : ''}>
          <span class="name">${esc(name)}${has ? ' <span class="muted">✓ vorhanden</span>' : ''}</span>
          <input type="number" min="1" max="999" value="${n}" data-f="n">${unitSel(u)}</div>`;
      }).join('')}
    </details>`).join('')}
    <button class="btn primary block" data-act="tplAdd" style="position:sticky;bottom:calc(76px + env(safe-area-inset-bottom))">Ausgewählte hinzufügen</button>`;
}

function viewVerlauf() {
  if (!S.log.length) return '<p class="empty">Noch nichts erledigt.</p>';
  let lastDate = '';
  return S.log.map((l) => {
    const head = l.date !== lastDate ? `<h2>${fmtDate(l.date)}</h2>` : '';
    lastDate = l.date;
    return `${head}<div class="list-row">
      <div><div>${l.type === 'skip' ? '⏭️' : '✅'} <b>${esc(l.taskTitle)}</b></div>
      <div class="sub">${esc(userName(l.userId))}${l.type === 'skip' ? ' · übersprungen' : ''}${l.note ? ' · „' + esc(l.note) + '“' : ''}</div></div>
      <button class="btn small" data-act="undo" data-id="${l.id}">↩︎</button></div>`;
  }).join('');
}

function viewTeam() {
  const since = addDays(localToday(), -30);
  return `<div class="panel"><b>Mitglieder einladen</b>
      <p class="muted" style="margin:4px 0 0;font-size:.9rem">Teile die Adresse dieser Seite und den Team-Code. Neue Personen wählen „Registrieren“.</p></div>
    <h2>Mitglieder (${S.users.length})</h2>
    ${S.users.map((u) => {
      const cnt = S.log.filter((l) => l.userId === u.id && l.type === 'done' && l.date >= since).length;
      const open = S.tasks.filter((t) => t.assignee === u.id).length;
      return `<div class="list-row"><div><b>${esc(u.name)}</b> ${u.admin ? '<span class="badge me">Admin</span>' : ''}${u.id === S.me.id ? ' <span class="badge">du</span>' : ''}
        <div class="sub">${cnt} erledigt (30 Tage) · ${open} zugewiesen</div></div>
        ${S.me.admin && u.id !== S.me.id ? `<button class="btn small danger" data-act="deluser" data-id="${u.id}">Entfernen</button>` : ''}</div>`;
    }).join('')}`;
}

// ================= Dialoge =================
const dlg = $('#dlg'), dlgForm = $('#dlgForm');
function openDialog(html, onSubmit) {
  dlgForm.innerHTML = html;
  dlgForm.onsubmit = async (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancel') return dlg.close();
    const ok = await onSubmit(new FormData(dlgForm), e.submitter?.value);
    if (ok !== false) dlg.close();
  };
  dlg.showModal();
}
function openMenu(items, title) {
  openDialog(`${title ? `<h3>${esc(title)}</h3>` : ''}<div class="menu-list">
    ${items.map(([label, , cls], i) => `<button type="button" data-i="${i}" class="${cls || ''}">${label}</button>`).join('')}</div>
    <div class="actions"><button class="btn" value="cancel">Schliessen</button></div>`, () => {});
  $$('.menu-list button', dlgForm).forEach((b) => b.addEventListener('click', () => { dlg.close(); items[b.dataset.i][1](); }));
}

function openDoneDialog(t, type = 'done') {
  openDialog(`<h3>${type === 'done' ? '✅ Erledigt' : '⏭️ Überspringen'}: ${esc(t.title)}</h3>
    <label>Datum<input type="date" name="date" value="${localToday()}" max="${localToday()}" required></label>
    <label>Notiz (optional)<input name="note" placeholder="${type === 'done' ? 'z. B. Filter ersetzt' : 'Grund'}"></label>
    <div class="actions"><button class="btn" value="cancel">Abbrechen</button><button class="btn primary">Speichern</button></div>`,
    (fd) => mutate(`tasks/${t.id}/${type}`, 'POST', Object.fromEntries(fd), type === 'done' ? '✅ Erledigt – gut gemacht!' : 'Übersprungen'));
}

function openTaskDialog(t = null) {
  const v = t || { title: '', area: '', notes: '', intervalValue: 1, intervalUnit: 'week', schedule: 'completion',
    assignMode: 'none', assignee: null, members: S.users.map((u) => u.id), nextDue: localToday() };
  const areas = [...new Set(S.tasks.map((x) => x.area).filter(Boolean))];
  const [, mm, dd] = v.nextDue.split('-');
  const dow = ((new Date(v.nextDue + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
  const [ym, yd] = (v.yearDate || `${mm}-${dd}`).split('-').map(Number);
  openDialog(`<h3>${t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>
    <label>Titel<input name="title" value="${esc(v.title)}" required maxlength="120"></label>
    <label>Bereich / Raum<input name="area" value="${esc(v.area)}" list="areaList" placeholder="z. B. Küche"></label>
    <datalist id="areaList">${[...areas, ...Object.keys(TEMPLATES)].map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
    <div class="row">
      <label>Alle<input type="number" name="intervalValue" min="1" max="999" value="${v.intervalValue}" required></label>
      <label>Einheit<select name="intervalUnit">${Object.keys(UNIT_LABEL).map((k) => `<option value="${k}" ${k === v.intervalUnit ? 'selected' : ''}>${UNIT_LABEL[k]}</option>`).join('')}</select></label>
    </div>
    <label>Rhythmus<select name="schedule" id="schedule">
      <option value="completion" ${!v.schedule || v.schedule === 'completion' ? 'selected' : ''}>Ab Erledigung</option>
      <option value="fixed" ${v.schedule === 'fixed' ? 'selected' : ''}>Fester Rhythmus</option>
      <option value="calendar" ${v.schedule === 'calendar' ? 'selected' : ''}>Bestimmter Tag (Wochentag / Datum)</option></select></label>
    <div id="calWeek"><span class="muted" style="font-size:.85rem">An diesen Wochentagen</span><div class="members">
      ${WD.map((w, i) => `<label><input type="checkbox" name="weekdays" value="${i + 1}" ${(v.weekdays || [dow]).includes(i + 1) ? 'checked' : ''}>${w}</label>`).join('')}</div><br></div>
    <label id="calMonth">Tag im Monat<select name="monthDay">
      ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${(v.monthDay ?? +dd) === i + 1 ? 'selected' : ''}>${i + 1}.${i >= 28 ? ' (sonst letzter Tag)' : ''}</option>`).join('')}
      <option value="-1" ${v.monthDay === -1 ? 'selected' : ''}>Letzter Tag des Monats</option></select></label>
    <div class="row" id="calYear">
      <label>Tag<select name="yDay">${Array.from({ length: 31 }, (_, i) => `<option ${yd === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label>Monat<select name="yMonth">${MONTHS.map((m, i) => `<option value="${i + 1}" ${ym === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    </div>
    <label><span id="dueLabel">Nächste Fälligkeit</span><input type="date" name="nextDue" value="${v.nextDue}" required></label>
    <label>Zuweisung<select name="assignMode" id="assignMode">
      <option value="none" ${v.assignMode === 'none' ? 'selected' : ''}>Niemand (wer Zeit hat)</option>
      <option value="fixed" ${v.assignMode === 'fixed' ? 'selected' : ''}>Feste Person</option>
      <option value="rotate" ${v.assignMode === 'rotate' ? 'selected' : ''}>Rotation</option></select></label>
    <label id="assigneeWrap">Person<select name="assignee">${S.users.map((u) => `<option value="${u.id}" ${u.id === v.assignee ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
    <div id="membersWrap"><span class="muted" style="font-size:.85rem">Rotation zwischen</span><div class="members">
      ${S.users.map((u) => `<label><input type="checkbox" name="members" value="${u.id}" ${(v.members || []).includes(u.id) ? 'checked' : ''}>${esc(u.name)}</label>`).join('')}</div><br></div>
    <label>Notizen / Anleitung<textarea name="notes" placeholder="z. B. Filtertyp, Mittel, Hinweise">${esc(v.notes)}</textarea></label>
    <div class="actions">${t ? '<button class="btn danger" value="delete" formnovalidate>Löschen</button><span class="spacer"></span>' : ''}
      <button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn primary" value="save">Speichern</button></div>`,
    async (fd, action) => {
      if (action === 'delete') {
        if (!confirm(`„${t.title}“ inkl. Verlauf löschen?`)) return false;
        return mutate(`tasks/${t.id}`, 'DELETE', null, 'Gelöscht');
      }
      const body = Object.fromEntries(fd);
      body.members = fd.getAll('members');
      body.intervalValue = Number(body.intervalValue);
      if (body.schedule === 'calendar') {
        body.weekdays = fd.getAll('weekdays').map(Number);
        body.monthDay = Number(body.monthDay);
        body.yearDate = `${pad(body.yMonth)}-${pad(body.yDay)}`;
        if (body.intervalUnit === 'week' && !body.weekdays.length) { toast('Mindestens einen Wochentag wählen'); return false; }
        if (body.intervalUnit === 'year' && Number(body.yDay) > new Date(Date.UTC(2024, Number(body.yMonth), 0)).getUTCDate()) { toast('Dieses Datum gibt es nicht'); return false; }
      } else { delete body.monthDay; }
      delete body.yDay; delete body.yMonth;
      if (body.assignMode === 'rotate' && !body.members.length) { toast('Mindestens eine Person für die Rotation wählen'); return false; }
      return t ? mutate(`tasks/${t.id}`, 'PUT', body, 'Gespeichert') : mutate('tasks', 'POST', body, 'Aufgabe erstellt');
    });
  const sync = () => {
    const m = $('#assignMode').value;
    $('#assigneeWrap').classList.toggle('hidden', m === 'none');
    $('#membersWrap').classList.toggle('hidden', m !== 'rotate');
    $('#assigneeWrap').firstChild.textContent = m === 'rotate' ? 'Aktuell an der Reihe' : 'Person';
  };
  $('#assignMode').addEventListener('change', sync); sync();
  const unitSel = $('[name=intervalUnit]', dlgForm), schedSel = $('#schedule');
  const syncCal = () => {
    const cal = schedSel.value === 'calendar';
    const dayOpt = $('option[value=day]', unitSel);
    dayOpt.disabled = cal;
    if (cal && unitSel.value === 'day') unitSel.value = 'week';
    const u = unitSel.value;
    $('#calWeek').classList.toggle('hidden', !(cal && u === 'week'));
    $('#calMonth').classList.toggle('hidden', !(cal && u === 'month'));
    $('#calYear').classList.toggle('hidden', !(cal && u === 'year'));
    $('#dueLabel').textContent = cal ? 'Starten ab (erster passender Tag wird gesucht)' : 'Nächste Fälligkeit';
  };
  unitSel.addEventListener('change', syncCal); schedSel.addEventListener('change', syncCal); syncCal();
}

function openNotifyDialog() {
  const m = S.me;
  openDialog(`<h3>🔔 Erinnerungen</h3>
    ${S.mailEnabled ? '' : '<p class="error">Mailversand ist auf dem Server noch nicht eingerichtet (RESEND_API_KEY fehlt).</p>'}
    <label>E-Mail-Adresse<input type="email" name="email" value="${esc(m.email)}" autocomplete="email"></label>
    <label>Tägliche Zusammenfassung<select name="notify">
      <option value="daily" ${m.notify === 'daily' ? 'selected' : ''}>Ein – wenn etwas fällig ist</option>
      <option value="off" ${m.notify !== 'daily' ? 'selected' : ''}>Aus</option></select></label>
    <div class="row">
      <label>Uhrzeit<select name="notifyHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === m.notifyHour ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
      <label>Inhalt<select name="notifyScope">
        <option value="mine" ${m.notifyScope !== 'all' ? 'selected' : ''}>Meine & offene</option>
        <option value="all" ${m.notifyScope === 'all' ? 'selected' : ''}>Alle Aufgaben</option></select></label>
    </div>
    <p class="muted" style="font-size:.85rem;margin-top:0">Die Mail kommt nur, wenn Aufgaben überfällig oder heute fällig sind.</p>
    <div class="actions"><button class="btn" value="test">Test-Mail</button><span class="spacer"></span>
      <button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn primary" value="save">Speichern</button></div>`,
    async (fd, action) => {
      const ok = await mutate('me', 'PUT', Object.fromEntries(fd), action === 'test' ? null : 'Gespeichert');
      if (!ok) return false;
      if (action === 'test') {
        try { await api('me/testmail', 'POST', {}); toast('📧 Test-Mail verschickt an ' + S.me.email); }
        catch (e) { toast('⚠️ ' + e.message); }
      }
    });
}

function openPasswordDialog() {
  openDialog(`<h3>Passwort ändern</h3>
    <label>Altes Passwort<input type="password" name="oldPassword" required autocomplete="current-password"></label>
    <label>Neues Passwort<input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
    <div class="actions"><button class="btn" value="cancel" formnovalidate>Abbrechen</button><button class="btn primary">Speichern</button></div>`,
    (fd) => mutate('me', 'PUT', Object.fromEntries(fd), 'Passwort geändert'));
}

// ================= Events =================
$('#main').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  const task = S.tasks.find((t) => t.id === id);
  if (act === 'mine') { onlyMine = el.checked; localStorage.setItem('pp_mine', onlyMine ? '1' : '0'); render(); return; }
  if (act === 'done' && task) openDoneDialog(task);
  if (act === 'newtask') openTaskDialog();
  if (act === 'edit' && task) openTaskDialog(task);
  if (act === 'goto') $(`.bottomnav [data-view=${el.dataset.view}]`).click();
  if (act === 'taskmenu' && task) openMenu([
    ['✅ Erledigt…', () => openDoneDialog(task)],
    ['⚡ Sofort erledigt (heute)', () => mutate(`tasks/${task.id}/done`, 'POST', { date: localToday() }, '✅ Erledigt')],
    ['⏭️ Diesmal überspringen', () => openDoneDialog(task, 'skip')],
    ['✏️ Bearbeiten', () => openTaskDialog(task)],
  ], task.title + (task.notes ? ' — ' + task.notes : ''));
  if (act === 'undo') {
    if (confirm('Eintrag rückgängig machen? (Beim letzten Eintrag einer Aufgabe wird auch die Fälligkeit zurückgesetzt.)'))
      mutate(`log/${id}`, 'DELETE', null, 'Rückgängig gemacht');
  }
  if (act === 'deluser') {
    if (confirm(`${userName(id)} aus dem Team entfernen?`)) mutate(`users/${id}`, 'DELETE', null, 'Entfernt');
  }
  if (act === 'tplAdd') {
    const assign = $('#tplAssign').value, spread = $('#tplSpread').checked;
    const rows = $$('.tpl-item').filter((r) => $('[data-f=on]', r).checked);
    if (!rows.length) return toast('Bitte mindestens eine Vorlage wählen');
    const tasks = rows.map((r, i) => {
      const n = Number($('[data-f=n]', r).value) || 1, u = $('[data-f=unit]', r).value;
      const span = Math.min(n * UNIT_DAYS[u], 28);
      const offset = spread ? Math.floor(((i * 7919) % 97) / 97 * span) : 0;
      return {
        title: r.dataset.name, area: r.dataset.cat, intervalValue: n, intervalUnit: u, nextDue: addDays(localToday(), offset),
        assignMode: assign === 'rotate' ? 'rotate' : assign === 'none' ? 'none' : 'fixed',
        assignee: assign.startsWith('u:') ? assign.slice(2) : null,
        members: S.users.map((x) => x.id),
      };
    });
    if (await mutate('tasks/bulk', 'POST', { tasks }, `✨ ${tasks.length} Aufgaben erstellt`)) $('.bottomnav [data-view=heute]').click();
  }
});

// ================= Start =================
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 60000);
if (token) { showApp(); refresh(); } else showAuth();
