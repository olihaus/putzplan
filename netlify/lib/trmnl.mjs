// Daten für ein TRMNL-Private-Plugin (Polling): offene Aufgaben, fertig formatiert für Liquid.
import { localNow } from './notify.mjs';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const dayNum = (ds) => { const [y, m, d] = ds.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const dow = (ds) => new Date(dayNum(ds) * 864e5).getUTCDay();

function dueLabel(ds, today) {
  const d = dayNum(ds) - dayNum(today);
  if (d < -1) return `seit ${-d} Tagen`;
  if (d === -1) return 'seit gestern';
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d < 7) return WD[dow(ds)];
  const [, m, dd] = ds.split('-').map(Number);
  return `${dd}.${m}.`;
}

/**
 * @param {object} db
 * @param {URLSearchParams} q  person=<Name>, days=<Tage voraus, Std. 7>, limit=<Std. 10>, undated=0|1
 */
export function trmnlData(db, q, now = new Date()) {
  const { date: today } = localNow(now);
  const days = Math.min(Math.max(parseInt(q.get('days') ?? '7', 10) || 0, 0), 60);
  const limit = Math.min(Math.max(parseInt(q.get('limit') ?? '10', 10) || 1, 1), 40);
  const withUndated = q.get('undated') !== '0';
  const personName = (q.get('person') || '').trim().toLowerCase();
  const person = personName ? db.users.find((u) => u.name.toLowerCase() === personName) : null;
  const name = (id) => db.users.find((u) => u.id === id)?.name || '';

  let open = db.tasks.filter((t) => !t.completedAt);
  if (person) open = open.filter((t) => t.assignee === person.id || !t.assignee);

  const horizon = dayNum(today) + days;
  const status = (t) => {
    if (!t.nextDue) return 'none';
    const d = dayNum(t.nextDue) - dayNum(today);
    return d < 0 ? 'late' : d === 0 ? 'today' : 'soon';
  };
  const dated = open.filter((t) => t.nextDue && dayNum(t.nextDue) <= horizon).sort((a, b) => (a.nextDue > b.nextDue ? 1 : -1));
  const undated = withUndated ? open.filter((t) => !t.nextDue).sort((a, b) => a.title.localeCompare(b.title, 'de')) : [];
  const all = [...dated, ...undated];

  const toItem = (t) => ({
    title: t.title,
    area: t.area || '',
    due: t.nextDue ? dueLabel(t.nextDue, today) : 'ohne Termin',
    date: t.nextDue || '',
    status: status(t),
    who: name(t.assignee),
    who_initial: name(t.assignee).slice(0, 1).toUpperCase(),
  });

  const count = (s) => all.filter((t) => status(t) === s).length;
  const overdue = count('late'), dueToday = count('today'), soon = count('soon');
  const parts = [];
  if (dueToday) parts.push(`${dueToday} heute`);
  if (overdue) parts.push(`${overdue} überfällig`);
  const [, m, d] = today.split('-').map(Number);
  const hhmm = new Intl.DateTimeFormat('de-CH', { timeZone: process.env.APP_TIMEZONE || 'Europe/Zurich', hour: '2-digit', minute: '2-digit' }).format(now);

  return {
    date_label: `${WD[dow(today)]}, ${d}. ${MON[m - 1]}`,
    updated: hhmm,
    person: person?.name || '',
    summary: parts.length ? parts.join(', ') : 'nichts fällig',
    overdue, today: dueToday, upcoming: soon, undated: undated.length,
    total: all.length,
    tasks: all.slice(0, limit).map(toItem),
    urgent: all.filter((t) => ['late', 'today'].includes(status(t))).slice(0, limit).map(toItem),
    later: all.filter((t) => !['late', 'today'].includes(status(t))).slice(0, limit).map(toItem),
    more: Math.max(all.length - limit, 0),
  };
}
