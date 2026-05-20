const WEEKDAY_TIMES = ["19:00", "21:00"];
const SATURDAY_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"];
const MAX_BOOKING_DAYS = 60;

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function todayFrom(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

function isPastTime(dateString, time, now = new Date()) {
  const date = parseDateOnly(dateString);
  if (!date) return true;
  const [hour, minute] = time.split(":").map(Number);
  const slot = new Date(date);
  slot.setHours(hour, minute, 0, 0);
  return slot <= now;
}

function getScheduledTimes(dateString, now = new Date(), businessHours = null) {
  const date = parseDateOnly(dateString);
  if (!date) return [];

  const day = date.getDay();
  const configuredDay = Array.isArray(businessHours)
    ? businessHours.find((item) => Number(item.dayOfWeek) === day)
    : null;

  if (configuredDay && !configuredDay.isOpen) return [];
  if (!configuredDay && day === 0) return [];

  const baseTimes = configuredDay ? configuredDay.times : (day === 6 ? SATURDAY_TIMES : WEEKDAY_TIMES);
  const today = todayFrom(now);
  if (date.getTime() !== today.getTime()) {
    return baseTimes;
  }

  return baseTimes.filter((time) => !isPastTime(dateString, time, now));
}

function isDateBookable(dateString, now = new Date(), options = {}) {
  const date = parseDateOnly(dateString);
  if (!date) return false;

  const today = todayFrom(now);
  const maxDate = addDays(today, options.maxBookingDays || MAX_BOOKING_DAYS);
  if (date < today || date > maxDate) return false;
  return getScheduledTimes(dateString, now, options.businessHours).length > 0;
}

function normalizeRange(from, to, now = new Date(), maxBookingDays = MAX_BOOKING_DAYS) {
  const today = todayFrom(now);
  const maxDate = addDays(today, maxBookingDays);
  const fromDate = parseDateOnly(from) || today;
  const toDate = parseDateOnly(to) || addDays(fromDate, 14);
  const start = fromDate < today ? today : fromDate;
  const end = toDate > maxDate ? maxDate : toDate;

  if (end < start) {
    return { start, end: start };
  }

  return { start, end };
}

module.exports = {
  WEEKDAY_TIMES,
  SATURDAY_TIMES,
  MAX_BOOKING_DAYS,
  parseDateOnly,
  formatDateOnly,
  addDays,
  todayFrom,
  getScheduledTimes,
  isDateBookable,
  normalizeRange
};
