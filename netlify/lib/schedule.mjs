// Termin-Logik: Intervalle, kalenderbasierte Wiederholungen und einmalige Aufgaben.
// Datumswerte immer als 'YYYY-MM-DD'.

const parse = (ds) => ds.split('-').map(Number);
const fmt = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const dayNum = (ds) => { const [y, m, d] = parse(ds); return Date.UTC(y, m - 1, d) / 864e5; };
const plusDays = (ds, n) => { const [y, m, d] = parse(ds); return fmt(y, m, d + n); };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isoDow = (ds) => ((new Date(dayNum(ds) * 864e5).getUTCDay() + 6) % 7) + 1; // Mo=1 … So=7
const mod = (a, n) => ((a % n) + n) % n;

export function addInterval(ds, n, unit) {
  const [y, m, d] = parse(ds);
  if (unit === 'day' || unit === 'week') return fmt(y, m, d + n * (unit === 'week' ? 7 : 1));
  const total = (m - 1) + (unit === 'year' ? n * 12 : n);
  const ny = y + Math.floor(total / 12), nm = mod(total, 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Jahresdaten einer Aufgabe ('MM-DD'), kompatibel mit dem alten Einzelfeld yearDate. */
export const yearDatesOf = (t) => (t.yearDates?.length ? t.yearDates : t.yearDate ? [t.yearDate] : []);

/** Passt das Datum zur Kalender-Regel? anchor = Referenztermin für "alle N …" (null = ohne Takt-Prüfung). */
export function matches(t, ds, anchor = t.anchor) {
  const [y, m, d] = parse(ds);
  const n = t.intervalValue || 1;
  if (t.intervalUnit === 'week') {
    if (!(t.weekdays || []).includes(isoDow(ds))) return false;
    if (!anchor || n === 1) return true;
    const monday = (x) => dayNum(x) - (isoDow(x) - 1);
    return mod(Math.round((monday(ds) - monday(anchor)) / 7), n) === 0;
  }
  if (t.intervalUnit === 'month') {
    const target = t.monthDay === -1 ? daysInMonth(y, m) : Math.min(t.monthDay, daysInMonth(y, m));
    if (d !== target) return false;
    if (!anchor || n === 1) return true;
    const [ay, am] = parse(anchor);
    return mod((y * 12 + m) - (ay * 12 + am), n) === 0;
  }
  if (t.intervalUnit === 'year') {
    const hit = yearDatesOf(t).some((yd) => {
      const [tm, td] = yd.split('-').map(Number);
      const target = tm === 2 && td === 29 && daysInMonth(y, 2) === 28 ? 28 : td;
      return m === tm && d === target;
    });
    if (!hit) return false;
    if (!anchor || n === 1) return true;
    return mod(y - parse(anchor)[0], n) === 0;
  }
  return false;
}

/** Erster passender Termin am oder nach `from`. */
export function firstOnOrAfter(t, from, anchor = t.anchor) {
  const n = t.intervalValue || 1;
  const limit = 370 * (t.intervalUnit === 'year' ? n : Math.ceil(n / 12) + 1) + 400;
  let ds = from;
  for (let i = 0; i < limit; i++, ds = plusDays(ds, 1)) if (matches(t, ds, anchor)) return ds;
  return from; // sollte nie passieren
}

/** Kalender-Regel: ersten Termin ab t.nextDue suchen und als Takt-Anker setzen. */
export function setupCalendar(t) {
  const first = firstOnOrAfter(t, t.nextDue, null);
  t.nextDue = first;
  t.anchor = first;
}

/** Nächste Fälligkeit nach Erledigung/Überspringen am `date` (nicht für einmalige Aufgaben). */
export function nextDueAfter(t, date) {
  const { intervalValue: n, intervalUnit: u } = t;
  if (t.schedule === 'calendar') {
    const base = date >= t.nextDue ? date : t.nextDue;
    return firstOnOrAfter(t, plusDays(base, 1));
  }
  if (t.schedule === 'fixed') {
    let next = t.nextDue;
    do { next = addInterval(next, n, u); } while (next <= date);
    return next;
  }
  return addInterval(date, n, u);
}
