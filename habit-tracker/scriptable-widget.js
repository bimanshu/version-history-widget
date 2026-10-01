// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: check-circle;

/*
 * Habit 30 — Home Screen widget for the free Scriptable app (https://scriptable.app).
 *
 * Setup:
 *   1. In Scriptable tap +, paste this whole script, and rename it to "Habit30".
 *   2. Add a large Scriptable widget to your Home Screen and pick "Habit30" as its script.
 *   3. In the Habit 30 app, tap "Update widget". That opens this script with your
 *      progress, which it saves for the widget to show.
 *
 * The day counter updates on its own. Check-ins show up after you tap "Update widget".
 */

const DEFAULT_START = '2026-10-01';
const LENGTH = 30;
const fm = FileManager.local();
const FILE = fm.joinPath(fm.documentsDirectory(), 'habit30.json');

const C = {
  bg: dyn('#f6f5f1', '#111312'),
  card: dyn('#ffffff', '#1b1e1c'),
  text: dyn('#1c1d1b', '#ecece8'),
  muted: dyn('#6a6c66', '#9a9d99'),
  line: dyn('#d9d7ce', '#3a3f3b'),
  accent: dyn('#2f7d5b', '#4fbf8b'),
  levels: [dyn('#e6e4dc', '#262a28'), dyn('#cfe6d9', '#1f3f30'), dyn('#9fd0b5', '#2a6347'), dyn('#5fb08a', '#3c8f66'), dyn('#2f7d5b', '#4fbf8b')],
  onLevels: [dyn('#1c1d1b', '#ecece8'), dyn('#1c1d1b', '#ecece8'), dyn('#1c1d1b', '#ecece8'), dyn('#ffffff', '#ecece8'), dyn('#ffffff', '#08130d')],
};
const RING = new Color('#43a878');

function dyn(light, dark) { return Color.dynamic(new Color(light), new Color(dark)); }

// ---- Data -------------------------------------------------------------------

const params = args.queryParameters || {};
if (params.data) {
  // Opened from the Habit 30 app's "Update widget" button.
  let data = null;
  try { data = JSON.parse(params.data); } catch (e) { /* handled below */ }
  if (!data || !Array.isArray(data.habits)) {
    const a = new Alert();
    a.title = 'Couldn’t read your progress';
    a.message = 'Go back to Habit 30 and tap Update widget again.';
    a.addAction('OK');
    await a.present();
    Script.complete();
    return;
  }
  data.syncedAt = Date.now();
  fm.writeString(FILE, JSON.stringify(data));
}

const data = load();
const widget = build(data, config.widgetFamily || 'large');
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();

function load() {
  try {
    if (fm.fileExists(FILE)) return JSON.parse(fm.readString(FILE));
  } catch (e) { /* fall through to empty data */ }
  return null;
}

// ---- Dates (local "YYYY-MM-DD" strings, same as the app) -------------------

function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number), [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5);
}
function fmt(s, opts) { return parse(s).toLocaleDateString(undefined, opts); }
function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

// ---- Stats (mirrors the app's Progress screen) -----------------------------

function compute(data) {
  const start = data && /^\d{4}-\d{2}-\d{2}$/.test(data.start) ? data.start : DEFAULT_START;
  const habits = data && Array.isArray(data.habits) ? data.habits : [];
  const log = (data && data.log) || {};
  const today = iso(new Date());
  const dates = Array.from({ length: LENGTH }, (_, i) => addDays(start, i));
  const ti = diffDays(start, today);
  const elapsed = Math.max(0, Math.min(LENGTH, ti + 1));
  const n = habits.length;

  const doneIds = (d) => new Set(log[d] || []);
  const doneCount = (d) => { const s = doneIds(d); return habits.filter((h) => s.has(h.id)).length; };
  const level = (d) => {
    const r = n ? doneCount(d) / n : 0;
    return r <= 0 ? 0 : r >= 1 ? 4 : r <= 1 / 3 ? 1 : r <= 2 / 3 ? 2 : 3;
  };

  let checks = 0, perfect = 0, run = 0, best = 0;
  const last = Math.min(ti, LENGTH - 1);
  for (let i = 0; i <= last; i++) {
    const k = doneCount(dates[i]);
    checks += k;
    if (n && k === n) { perfect++; best = Math.max(best, ++run); } else run = 0;
  }
  // Current perfect-day streak; today doesn't break it until the day is over.
  let streak = 0, i = last;
  const isPerfect = (d) => n > 0 && doneCount(d) === n;
  if (ti === last && i >= 0 && !isPerfect(dates[i])) i--;
  while (i >= 0 && isPerfect(dates[i])) { streak++; i--; }

  const focus = ti < 0 ? dates[0] : ti >= LENGTH ? dates[LENGTH - 1] : today;
  const focusDone = doneIds(focus);
  return {
    start, habits, dates, today, ti, n, level,
    dayNum: dates.indexOf(focus) + 1,
    focus,
    todayDone: habits.filter((h) => focusDone.has(h.id)).length,
    isDone: (h) => focusDone.has(h.id),
    completion: n && elapsed ? Math.round((100 * checks) / (n * elapsed)) : 0,
    perfect, streak, best,
    left: ti < 0 ? LENGTH : Math.max(0, LENGTH - ti),
    syncedAt: data && data.syncedAt,
  };
}

// ---- Widget -----------------------------------------------------------------

function build(data, family) {
  const s = compute(data);
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 16, 14, 16);

  // Ask iOS to redraw shortly after midnight so the day counter rolls over.
  const midnight = new Date(); midnight.setHours(24, 0, 30, 0);
  const soon = new Date(Date.now() + 30 * 60 * 1000);
  w.refreshAfterDate = midnight < soon ? midnight : soon;

  const size = widgetSize(family);
  const contentW = size.width - 32;

  if (family === 'small') {
    header(w, s, true);
    return w;
  }
  header(w, s, false);
  w.addSpacer(family === 'large' ? null : 8);
  grid(w, s, contentW, family === 'large' ? 3 : 2);
  if (family !== 'large') return w;

  // Flexible spacers share out whatever height is left, since widget sizes vary by iPhone.
  w.addSpacer();
  stats(w, s);
  w.addSpacer();
  todayList(w, s, contentW, size.height < 340 ? 2 : 3);
  return w;
}

function widgetSize(family) {
  // Estimate the widget's size from the screen width (iOS doesn't tell scripts directly).
  const scr = Device.screenSize();
  const width = Math.min(scr.width, scr.height);
  const large = Math.round(width * 0.84);
  if (family === 'small') return new Size(Math.round(large * 0.47), Math.round(large * 0.47));
  if (family === 'medium') return new Size(large, Math.round(large * 0.47));
  return new Size(large, Math.round(large * 1.05));
}

function text(stack, str, font, color, lines) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines || 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function header(w, s, compact) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();

  const left = row.addStack();
  left.layoutVertically();
  const eyebrow = s.ti < 0 ? 'STARTS IN ' + plural(-s.ti, 'DAY') : s.ti >= LENGTH ? 'CHALLENGE COMPLETE' : 'HABIT 30';
  text(left, eyebrow, Font.semiboldSystemFont(11), C.accent);
  left.addSpacer(2);
  const title = left.addStack();
  title.layoutHorizontally();
  title.bottomAlignContent();
  text(title, 'Day ' + s.dayNum, Font.boldSystemFont(compact ? 24 : 28), C.text);
  title.addSpacer(5);
  text(title, 'of ' + LENGTH, Font.semiboldSystemFont(compact ? 13 : 15), C.muted);
  left.addSpacer(2);
  text(left, fmt(s.focus, compact ? { month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric' }), Font.systemFont(12), C.muted);

  row.addSpacer();
  if (!s.n) return;
  const d = compact ? 46 : 58;
  const ring = row.addStack();
  ring.size = new Size(d, d);
  ring.backgroundImage = ringImage(s.todayDone / s.n, d);
  ring.centerAlignContent();
  ring.addSpacer();
  text(ring, s.todayDone + '/' + s.n, Font.boldRoundedSystemFont(compact ? 13 : 15), C.text);
  ring.addSpacer();
}

function ringImage(p, d) {
  const dc = new DrawContext();
  dc.size = new Size(d, d);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const lw = d >= 50 ? 6 : 5, r = (d - lw) / 2, c = d / 2;
  dc.setStrokeColor(new Color(RING.hex, 0.22));
  dc.setLineWidth(lw);
  dc.strokeEllipse(new Rect(lw / 2, lw / 2, d - lw, d - lw));
  if (p > 0) {
    const steps = Math.max(2, Math.ceil(p * 120));
    const path = new Path();
    const point = (t) => new Point(c + r * Math.cos(-Math.PI / 2 + 2 * Math.PI * p * t), c + r * Math.sin(-Math.PI / 2 + 2 * Math.PI * p * t));
    for (let i = 0; i <= steps; i++) {
      if (i === 0) path.move(point(0)); else path.addLine(point(i / steps));
    }
    dc.addPath(path);
    dc.setStrokeColor(RING);
    dc.setLineWidth(lw);
    dc.strokePath();
    // Round caps
    dc.setFillColor(RING);
    for (const t of [0, 1]) {
      const pt = point(t);
      dc.fillEllipse(new Rect(pt.x - lw / 2, pt.y - lw / 2, lw, lw));
    }
  }
  return dc.getImage();
}

function grid(w, s, contentW, rows) {
  const cols = Math.ceil(LENGTH / rows), gap = 4;
  const cell = Math.floor((contentW - gap * (cols - 1)) / cols);
  const box = w.addStack();
  box.layoutVertically();
  box.spacing = gap;
  for (let r = 0; r < rows; r++) {
    const line = box.addStack();
    line.layoutHorizontally();
    line.spacing = gap;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= LENGTH) break;
      const d = s.dates[i];
      const future = d > s.today;
      const lv = future ? 0 : s.level(d);
      const sq = line.addStack();
      sq.size = new Size(cell, cell);
      sq.cornerRadius = Math.round(cell * 0.24);
      sq.centerAlignContent();
      if (future) {
        sq.borderWidth = 1;
        sq.borderColor = C.line;
      } else {
        sq.backgroundColor = C.levels[lv];
      }
      if (d === s.today) {
        sq.borderWidth = 2;
        sq.borderColor = C.text;
      }
      sq.addSpacer();
      text(sq, String(parse(d).getDate()), Font.semiboldRoundedSystemFont(Math.max(9, Math.round(cell * 0.4))), future ? C.muted : C.onLevels[lv]);
      sq.addSpacer();
    }
  }
}

function stats(w, s) {
  const row = w.addStack();
  row.layoutHorizontally();
  const items = [
    [s.completion + '%', 'DONE'],
    [String(s.perfect), 'PERFECT DAYS'],
    ['🔥 ' + s.streak, 'STREAK'],
    [String(s.left), 'DAYS LEFT'],
  ];
  items.forEach(([value, label], i) => {
    if (i) row.addSpacer();
    const col = row.addStack();
    col.layoutVertically();
    text(col, value, Font.boldRoundedSystemFont(19), C.text);
    text(col, label, Font.semiboldSystemFont(9), C.muted);
  });
}

function todayList(w, s, contentW, rows) {
  const head = w.addStack();
  head.layoutHorizontally();
  head.bottomAlignContent();
  text(head, s.focus === s.today ? 'TODAY' : 'DAY ' + s.dayNum, Font.semiboldSystemFont(11), C.muted);
  head.addSpacer();
  if (s.syncedAt) {
    const at = new Date(s.syncedAt);
    const when = iso(at) === s.today
      ? at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    text(head, 'Updated ' + when, Font.systemFont(10), C.muted);
  }
  w.addSpacer(6);

  if (!s.n) {
    const msg = w.addStack();
    text(msg, 'Open Habit 30 and tap “Update widget” in Setup to show your habits here.', Font.mediumSystemFont(12), C.muted, 2);
    msg.addSpacer();
    return;
  }

  const gap = 10, colW = Math.floor((contentW - gap) / 2);
  const max = rows * 2;
  const shown = s.habits.length > max ? s.habits.slice(0, max - 1) : s.habits;
  const extra = s.habits.length - shown.length;
  const cells = shown.map((h) => ({ h }));
  if (extra) cells.push({ more: extra });

  const box = w.addStack();
  box.layoutVertically();
  box.spacing = 6;
  for (let r = 0; r * 2 < cells.length; r++) {
    const line = box.addStack();
    line.layoutHorizontally();
    line.spacing = gap;
    for (const item of cells.slice(r * 2, r * 2 + 2)) {
      const cell = line.addStack();
      cell.layoutHorizontally();
      cell.centerAlignContent();
      cell.size = new Size(colW, 0);
      if (item.more) {
        text(cell, '+' + item.more + ' more', Font.mediumSystemFont(12), C.muted);
      } else {
        const done = s.isDone(item.h);
        const sym = SFSymbol.named(done ? 'checkmark.circle.fill' : 'circle');
        sym.applyFont(Font.systemFont(15));
        const img = cell.addImage(sym.image);
        img.imageSize = new Size(15, 15);
        img.tintColor = done ? C.accent : C.line;
        cell.addSpacer(6);
        text(cell, (item.h.emoji ? item.h.emoji + ' ' : '') + item.h.name, Font.mediumSystemFont(12), done ? C.text : C.muted);
      }
      cell.addSpacer();
    }
  }
}
