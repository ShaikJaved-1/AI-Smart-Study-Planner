// All dates are 'YYYY-MM-DD' strings; arithmetic is done in UTC to avoid DST problems.
const pad = (n) => String(n).padStart(2, '0');

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const formatDate = (d) => d.toISOString().slice(0, 10);

function isValidDateString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return formatDate(parseDate(s)) === s;
}
function addDays(s, n) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}
// Monday of the week containing the date
function weekStart(s) {
  return addDays(s, -((parseDate(s).getUTCDay() + 6) % 7));
}
function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}
const minutesToTime = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

module.exports = { parseDate, formatDate, isValidDateString, addDays, daysBetween, todayStr, weekStart, timeToMinutes, minutesToTime };
