/** Local-calendar calculations for a same-day work schedule.
 * Calendar-aware monthly salary is inspired by WizzenH/xindong (MIT):
 * https://github.com/WizzenH/xindong
 */
import { getOfficialDay } from './holidays.js';

export const DEFAULT_SETTINGS = Object.freeze({
  salaryMode: 'daily',
  dailySalary: 120,
  monthlySalary: 5000,
  startTime: '08:30',
  endTime: '17:00',
  breakEnabled: false,
  breakStart: '12:00',
  breakEnd: '13:00',
  workdays: Object.freeze([1, 2, 3, 4, 5]),
  useChinaHolidays: true,
  calendarOverrides: Object.freeze({}),
  goalName: '一场电影',
  goalAmount: 45,
});

const HOUR = 60 * 60 * 1000;

function timeMinutes(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function merged(settings) {
  return { ...DEFAULT_SETTINGS, ...settings };
}

function validCalendarDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(key)) return false;
  const [year, month, day] = key.split('-').map(Number);
  if (year === 0) return false;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function calendarErrors(s, allowEmptyWorkdays = false) {
  const errors = [];
  if (!Array.isArray(s.workdays) || (!allowEmptyWorkdays && s.workdays.length === 0)
      || s.workdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)
      || new Set(s.workdays).size !== s.workdays.length) {
    errors.push('请至少选择一个工作日，星期范围为周日到周六');
  }
  if (typeof s.useChinaHolidays !== 'boolean') errors.push('国家放假调休开关无效');
  const overrides = s.calendarOverrides;
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(overrides))
      || Reflect.ownKeys(overrides).some(key => !validCalendarDateKey(key) || typeof overrides[key] !== 'boolean')) {
    errors.push('日历调整需要使用有效的 YYYY-MM-DD 日期和工作日/休息日状态');
  }
  return errors;
}

/** Empty array means valid. Partial settings inherit the defaults. */
export function validateSettings(settings = {}) {
  const s = merged(settings);
  const errors = [];
  if (!['daily', 'monthly'].includes(s.salaryMode)) errors.push('请选择日薪或月薪模式');
  if (typeof s.dailySalary !== 'number' || !Number.isFinite(s.dailySalary) || s.dailySalary <= 0) {
    errors.push('日薪需要是大于 0 的数字');
  }
  if (typeof s.monthlySalary !== 'number' || !Number.isFinite(s.monthlySalary) || s.monthlySalary <= 0) {
    errors.push('月薪需要是大于 0 的数字');
  }
  const start = timeMinutes(s.startTime);
  const end = timeMinutes(s.endTime);
  if (start === null || end === null) errors.push('上下班时间需要使用有效的 HH:mm 格式');
  else if (end <= start) errors.push('下班时间需要晚于上班时间，暂不支持跨夜班次');
  if (typeof s.breakEnabled !== 'boolean') errors.push('休息时间开关无效');
  if (s.breakEnabled) {
    const breakStart = timeMinutes(s.breakStart);
    const breakEnd = timeMinutes(s.breakEnd);
    if (breakStart === null || breakEnd === null) errors.push('休息时间需要使用有效的 HH:mm 格式');
    else if (breakEnd <= breakStart) errors.push('休息结束时间需要晚于开始时间');
    else if (start !== null && end !== null && (breakStart < start || breakEnd > end)) {
      errors.push('休息时间需要在上下班时间之内');
    } else if (start !== null && end !== null && breakEnd - breakStart >= end - start) {
      errors.push('每天需要保留一段工作时间');
    }
  }
  errors.push(...calendarErrors(s));
  if (typeof s.goalName !== 'string' || !s.goalName.trim()) errors.push('请输入鼓励目标名称');
  if (typeof s.goalAmount !== 'number' || !Number.isFinite(s.goalAmount) || s.goalAmount <= 0) {
    errors.push('目标金额需要是大于 0 的数字');
  }
  return errors;
}

function checked(settings) {
  const errors = validateSettings(settings);
  if (errors.length) throw new RangeError(errors.join('；'));
  return merged(settings);
}

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('无效的日期');
  return date;
}

/** YYYY-MM-DD in the user's local calendar, never UTC slicing. */
export function dateKey(value) {
  const date = asDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calendarDay(s, date) {
  const key = dateKey(date);
  if (Object.hasOwn(s.calendarOverrides, key)) {
    const work = s.calendarOverrides[key];
    return { work, source: 'manual', label: work ? '补班' : '放假' };
  }
  const official = s.useChinaHolidays ? getOfficialDay(date) : null;
  if (official) return { ...official, source: 'official' };
  const work = s.workdays.includes(date.getDay());
  return { work, source: 'weekly', label: work ? '上班' : '休息' };
}

function scheduledWorkday(s, date) {
  return calendarDay(s, date).work;
}

/** Manual overrides > published official holidays/makeup days > weekly schedule. */
export function getCalendarDay(settings, value) {
  // Calendar previews must remain usable while unrelated form fields are incomplete.
  // Saving settings and all salary calculations still require full validation.
  const s = merged(settings);
  const errors = calendarErrors(s, true);
  if (errors.length) throw new RangeError(errors.join('；'));
  return calendarDay(s, asDate(value));
}

/** Resolve a workday using the same calendar as salary and pause calculations. */
export function isWorkday(settings, value) {
  return scheduledWorkday(checked(settings), asDate(value));
}

function monthWorkdayCount(s, date) {
  const day = new Date(date.getFullYear(), date.getMonth(), 1);
  let count = 0;
  while (day.getMonth() === date.getMonth()) {
    if (scheduledWorkday(s, day)) count += 1;
    day.setDate(day.getDate() + 1);
  }
  return count;
}

/** Number of scheduled dates in the date's entire local calendar month. */
export function countMonthWorkdays(settings, value) {
  return monthWorkdayCount(checked(settings), asDate(value));
}

function effectiveDailySalary(s, monthWorkdays) {
  return s.salaryMode === 'monthly' ? (monthWorkdays > 0 ? s.monthlySalary / monthWorkdays : 0) : s.dailySalary;
}

/** Monthly mode distributes salary over the month's actual scheduled days. */
export function dailyRate(settings, value) {
  const s = checked(settings);
  return effectiveDailySalary(s, monthWorkdayCount(s, asDate(value)));
}

function atMinutes(date, minutes) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
}

function schedule(s, date) {
  const start = atMinutes(date, timeMinutes(s.startTime));
  const end = atMinutes(date, timeMinutes(s.endTime));
  const breakStart = s.breakEnabled ? atMinutes(date, timeMinutes(s.breakStart)) : null;
  const breakEnd = s.breakEnabled ? atMinutes(date, timeMinutes(s.breakEnd)) : null;
  return { start, end, breakStart, breakEnd, total: end - start - (s.breakEnabled ? breakEnd - breakStart : 0) };
}

function overlap(start, end, from, until) {
  return Math.max(0, Math.min(end, until) - Math.max(start, from));
}

function dayWorkMs(s, date, from, until) {
  if (!scheduledWorkday(s, date) || until <= from) return 0;
  const shift = schedule(s, date);
  return overlap(shift.start, shift.end, from, until)
    - (s.breakEnabled ? overlap(shift.breakStart, shift.breakEnd, from, until) : 0);
}

/** Paid scheduled milliseconds in [startDate, endDate), excluding breaks/rest days.
 * Use this for pause exclusions so a pause spanning lunch does not deduct lunch twice.
 */
export function countWorkMs(settings, startDate, endDate) {
  const s = checked(settings);
  const start = asDate(startDate);
  const end = asDate(endDate);
  if (end <= start) return 0;
  let total = 0;
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (day.getTime() < end.getTime()) {
    total += dayWorkMs(s, day, start.getTime(), end.getTime());
    day.setDate(day.getDate() + 1);
  }
  return total;
}

function recordTime(value, day) {
  if (value === null || value === undefined) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed) || dateKey(new Date(parsed)) !== dateKey(day)) return null;
  return parsed;
}

/** Today's earnings: schedule elapsed before opening the app is included.
 * Records are scoped to one date. excludedMs must contain work time only.
 * Resetting should also clear excludedMs and pausedAt in the UI record.
 */
export function calculate(settings, now = new Date(), record = {}) {
  const s = checked(settings);
  const date = asDate(now);
  const current = date.getTime();
  const shift = schedule(s, date);
  const workingDay = scheduledWorkday(s, date);
  const monthWorkdays = monthWorkdayCount(s, date);
  const salary = effectiveDailySalary(s, monthWorkdays);
  const pausedAt = recordTime(record?.pausedAt, date);
  const resetAt = recordTime(record?.resetAt, date);
  const effectiveNow = pausedAt === null ? current : Math.min(current, pausedAt);
  const from = Math.max(shift.start, resetAt ?? shift.start);
  const excludedMs = Number.isFinite(record?.excludedMs) ? Math.max(0, record.excludedMs) : 0;
  const workedMs = Math.max(0, Math.min(shift.total, dayWorkMs(s, date, from, effectiveNow) - excludedMs));
  const secondRate = salary / (shift.total / 1000);
  let status;
  if (!workingDay) status = 'off';
  else if (current < shift.start) status = 'before';
  else if (current >= shift.end) status = 'finished';
  else if (pausedAt !== null && pausedAt <= current) status = 'paused';
  else if (s.breakEnabled && current >= shift.breakStart && current < shift.breakEnd) status = 'break';
  else status = 'working';
  return {
    earned: Math.min(salary, workedMs / 1000 * secondRate),
    workedMs,
    totalMs: shift.total,
    remainingMs: workingDay ? Math.max(0, shift.end - current) : 0,
    hourlyRate: salary / (shift.total / HOUR),
    secondRate,
    progress: workedMs / shift.total,
    status,
    dayTotal: workingDay ? salary : 0,
    effectiveDailySalary: salary,
    monthWorkdays,
  };
}

/** Schedule-based estimate: current settings for elapsed days this month only.
 * Saved daily pause/reset records are applied; future dates are never included.
 */
export function monthlyEarnings(settings, now = new Date(), records = {}) {
  const s = checked(settings);
  const date = asDate(now);
  let earned = 0;
  for (let day = 1; day <= date.getDate(); day += 1) {
    const value = day === date.getDate()
      ? date
      : new Date(date.getFullYear(), date.getMonth(), day, 23, 59, 59, 999);
    earned += calculate(s, value, records?.[dateKey(value)] ?? {}).earned;
  }
  return earned;
}
