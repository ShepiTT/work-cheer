import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, dateKey, calculate, countWorkMs, monthlyEarnings, validateSettings,
  isWorkday, countMonthWorkdays, dailyRate, getCalendarDay } from '../src/calculator.js';
import { HOLIDAY_SOURCE_URL, HOLIDAY_YEARS, getOfficialDay } from '../src/holidays.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const date = (clock, day = 3) => new Date(`2026-11-${String(day).padStart(2, '0')}T${clock}`);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('default settings and local date key', () => {
  assert.deepEqual(validateSettings(DEFAULT_SETTINGS), []);
  assert.equal(dateKey(date('00:01:00')), '2026-11-03');
  assert.equal(dateKey(date('23:59:00')), '2026-11-03');
});

test('before work has no earnings and a wall-clock countdown', () => {
  const result = calculate({}, date('08:00:00'));
  assert.equal(result.earned, 0);
  assert.equal(result.status, 'before');
  assert.equal(result.remainingMs, 9 * HOUR);
  assert.equal(result.totalMs, 8.5 * HOUR);
  assert.equal(result.dayTotal, 120);
});

test('first opening during a shift includes scheduled elapsed time', () => {
  const result = calculate({}, date('12:45:00'));
  assert.equal(result.status, 'working');
  assert.equal(result.workedMs, 4.25 * HOUR);
  near(result.earned, 60);
  near(result.progress, 0.5);
  near(result.hourlyRate, 120 / 8.5);
  near(result.secondRate, 120 / (8.5 * 3600));
});

test('end and after work earnings cap at daily salary', () => {
  for (const clock of ['17:00:00', '23:59:59']) {
    const result = calculate({}, date(clock));
    assert.equal(result.status, 'finished');
    assert.equal(result.remainingMs, 0);
    assert.equal(result.workedMs, 8.5 * HOUR);
    assert.equal(result.earned, 120);
    assert.equal(result.progress, 1);
  }
});

test('unpaid lunch pauses earnings and changes denominator', () => {
  const settings = { breakEnabled: true };
  const lunch = calculate(settings, date('12:30:00'));
  assert.equal(lunch.status, 'break');
  assert.equal(lunch.totalMs, 7.5 * HOUR);
  assert.equal(lunch.workedMs, 3.5 * HOUR);
  assert.equal(lunch.remainingMs, 4.5 * HOUR);
  assert.equal(calculate(settings, date('13:00:00')).status, 'working');
  near(calculate(settings, date('17:00:00')).earned, 120);
});

test('paused earnings stay frozen while end-of-shift countdown remains live', () => {
  const pausedAt = date('10:00:00').getTime();
  const early = calculate({}, date('11:00:00'), { pausedAt });
  const later = calculate({}, date('15:00:00'), { pausedAt });
  assert.equal(early.status, 'paused');
  assert.equal(later.workedMs, 1.5 * HOUR);
  assert.equal(later.earned, early.earned);
  assert.equal(later.remainingMs, 2 * HOUR);
});

test('scheduled finish takes precedence over paused status without restoring unearned wages', () => {
  const record = { pausedAt: date('10:00:00').getTime() };
  const paused = calculate({}, date('16:59:59'), record);
  assert.equal(paused.status, 'paused');
  for (const clock of ['17:00:00', '18:00:00', '23:59:59']) {
    const finished = calculate({}, date(clock), record);
    assert.equal(finished.status, 'finished');
    assert.equal(finished.remainingMs, 0);
    assert.equal(finished.earned, paused.earned);
    assert.equal(finished.workedMs, 1.5 * HOUR);
    assert.equal(finished.dayTotal, 120);
  }
});

test('resuming across lunch only excludes working portions of the pause', () => {
  const settings = { breakEnabled: true };
  const excludedMs = countWorkMs(settings, date('11:30:00'), date('13:30:00'));
  assert.equal(excludedMs, HOUR);
  const result = calculate(settings, date('14:00:00'), { excludedMs });
  assert.equal(result.workedMs, 3.5 * HOUR);
  near(result.earned, 56);
  assert.equal(countWorkMs(settings, date('12:00:00'), date('13:00:00')), 0);
});

test('reset starts accumulation at reset time with unchanged full-day rate', () => {
  const settings = { breakEnabled: true };
  const resetAt = date('11:30:00').toISOString();
  const result = calculate(settings, date('14:00:00'), { resetAt });
  assert.equal(result.workedMs, 1.5 * HOUR);
  assert.equal(result.totalMs, 7.5 * HOUR);
  assert.equal(result.remainingMs, 3 * HOUR);
  near(result.earned, 24);
  assert.equal(calculate(settings, date('11:30:00'), { resetAt }).earned, 0);
  assert.equal(calculate(settings, date('14:00:00'), { resetAt, excludedMs: 30 * MINUTE }).workedMs, HOUR);
});

test('rest day earns nothing, but Sunday can be configured as a workday', () => {
  const sunday = date('17:00:00', 1);
  const off = calculate({}, sunday);
  assert.equal(off.status, 'off');
  assert.equal(off.dayTotal, 0);
  assert.equal(off.earned, 0);
  assert.equal(off.remainingMs, 0);
  assert.deepEqual(validateSettings({ workdays: [0, 1, 2, 3, 4, 5, 6] }), []);
  assert.equal(calculate({ workdays: [0] }, sunday).earned, 120);
});

test('work interval helper clamps shift edges, crosses days, and skips weekends', () => {
  assert.equal(countWorkMs({}, date('07:00:00'), date('09:00:00')), 30 * MINUTE);
  assert.equal(countWorkMs({}, date('18:00:00'), date('19:00:00')), 0);
  assert.equal(countWorkMs({}, date('10:00:00'), date('09:00:00')), 0);
  assert.equal(countWorkMs({}, date('16:00:00', 6), date('09:30:00', 9)), 2 * HOUR);
});

test('month estimate includes prior scheduled workdays and partial today only', () => {
  near(monthlyEarnings({}, date('12:45:00')), 180);
  near(monthlyEarnings({}, date('08:00:00')), 120);
  const records = {
    '2026-11-02': { resetAt: date('12:45:00', 2).getTime() },
    '2026-11-04': { excludedMs: 8.5 * HOUR },
  };
  near(monthlyEarnings({}, date('12:45:00'), records), 120);
  near(monthlyEarnings({}, new Date('2026-12-01T08:00:00'), records), 0);
});

test('saved pauses cap historical day estimates', () => {
  const records = { '2026-11-02': { pausedAt: date('12:45:00', 2).toISOString() } };
  near(monthlyEarnings({}, date('12:45:00'), records), 120);
});

test('saved reset and pause survive a reload and stay confined to their calendar date', () => {
  const settings = { breakEnabled: true };
  const records = JSON.parse(JSON.stringify({
    '2026-11-03': {
      resetAt: date('11:30:00').getTime(),
      pausedAt: date('14:00:00').getTime(),
      excludedMs: 30 * MINUTE,
    },
  }));
  const evening = date('18:00:00');
  const finished = calculate(settings, evening, records[dateKey(evening)]);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.workedMs, HOUR);
  near(finished.earned, 16);

  const midnight = date('00:00:00', 4);
  const before = calculate(settings, midnight, records[dateKey(midnight)]);
  assert.equal(before.status, 'before');
  assert.equal(before.earned, 0);
  near(monthlyEarnings(settings, midnight, records), 136);

  const morning = date('09:30:00', 4);
  const freshDay = calculate(settings, morning, records[dateKey(morning)]);
  assert.equal(freshDay.status, 'working');
  assert.equal(freshDay.workedMs, HOUR);
  near(freshDay.earned, 16);
  near(monthlyEarnings(settings, morning, records), 152);
});

test('month rollover starts a new estimate and preserves prior-month records without counting them', () => {
  const records = {
    '2026-11-30': {
      resetAt: new Date('2026-11-30T10:00:00').getTime(),
      pausedAt: new Date('2026-11-30T12:00:00').getTime(),
      excludedMs: 30 * MINUTE,
    },
  };
  const midnight = new Date('2026-12-01T00:00:00');
  assert.equal(calculate({}, midnight, records[dateKey(midnight)]).status, 'before');
  assert.equal(monthlyEarnings({}, midnight, records), 0);
  near(monthlyEarnings({}, new Date('2026-12-01T12:45:00'), records), 60);
  assert.ok(records['2026-11-30'].pausedAt);
});

test('invalid or wrong-day records cannot leak earnings into another day', () => {
  near(calculate({}, date('12:45:00'), { pausedAt: 'bad', resetAt: 'bad', excludedMs: NaN }).earned, 60);
  near(calculate({}, date('12:45:00'), { pausedAt: date('09:00:00', 2), resetAt: date('12:00:00', 2) }).earned, 60);
  assert.equal(calculate({}, date('12:45:00'), { excludedMs: 100 * HOUR }).earned, 0);
});

test('reject invalid wages, goal amounts, times, shifts, breaks and weekdays', () => {
  for (const settings of [
    { dailySalary: 0 }, { dailySalary: -1 }, { dailySalary: NaN }, { dailySalary: Infinity },
    { startTime: '8:30' }, { startTime: '25:00' }, { endTime: '08:30' }, { endTime: '07:00' },
    { breakEnabled: true, breakStart: '07:00' },
    { breakEnabled: true, breakEnd: '18:00' },
    { breakEnabled: true, breakStart: '13:00', breakEnd: '12:00' },
    { breakEnabled: true, breakStart: '08:30', breakEnd: '17:00' },
    { breakEnabled: 'yes' }, { workdays: [] }, { workdays: [7] }, { workdays: [1, 1] },
    { workdays: ['1'] }, { goalName: '' }, { goalAmount: 0 }, { goalAmount: '45' },
  ]) {
    assert.ok(validateSettings(settings).length, JSON.stringify(settings));
    assert.throws(() => calculate(settings, date('10:00:00')), RangeError);
  }
});

test('old saved settings keep daily wages and inherit new monthly/calendar defaults', () => {
  const saved = JSON.parse(JSON.stringify({
    dailySalary: 180, startTime: '08:30', endTime: '17:00',
    breakEnabled: true, breakStart: '12:00', breakEnd: '13:00',
    workdays: [1, 2, 3, 4, 5], goalName: '午餐', goalAmount: 30,
  }));
  const migrated = { ...DEFAULT_SETTINGS, ...saved };
  assert.equal(migrated.salaryMode, 'daily');
  assert.equal(migrated.monthlySalary, 5000);
  assert.equal(migrated.useChinaHolidays, true);
  assert.deepEqual(migrated.calendarOverrides, {});
  assert.deepEqual(validateSettings(saved), []);
  const result = calculate(saved, date('17:00:00'));
  assert.equal(result.earned, 180);
  assert.equal(result.effectiveDailySalary, 180);
  assert.equal(result.monthWorkdays, 21);
  assert.equal(dailyRate(saved, date('17:00:00')), 180);
  assert.ok(!Object.hasOwn(saved, 'salaryMode'));
});

test('monthly salary uses actual February workdays, including a leap-year workday', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 4200, dailySalary: 123 };
  const leapDay = new Date('2024-02-29T17:00:00');
  assert.equal(countMonthWorkdays(settings, leapDay), 21);
  assert.equal(countMonthWorkdays(settings, new Date('2023-02-28T17:00:00')), 20);
  assert.equal(dailyRate(settings, leapDay), 200);
  assert.equal(dailyRate(settings, new Date('2023-02-28T17:00:00')), 210);
  const result = calculate(settings, leapDay);
  near(result.earned, 200);
  near(result.dayTotal, 200);
  near(result.hourlyRate, 200 / 8.5);
  assert.equal(result.effectiveDailySalary, 200);
  assert.equal(settings.dailySalary, 123);
  near(monthlyEarnings(settings, leapDay), 4200);
});

test('weekend makeup work changes the monthly divisor and interval counting', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 4400,
    calendarOverrides: { '2024-02-03': true } };
  const saturday = new Date('2024-02-03T12:45:00');
  assert.equal(isWorkday({}, saturday), false);
  assert.equal(isWorkday(settings, saturday), true);
  assert.equal(countMonthWorkdays(settings, saturday), 22);
  const result = calculate(settings, saturday);
  assert.equal(result.status, 'working');
  near(result.earned, 100);
  near(monthlyEarnings(settings, saturday), 500);
  assert.equal(countWorkMs(settings, new Date('2024-02-02T16:00:00'), new Date('2024-02-05T09:30:00')), 10.5 * HOUR);
});

test('weekday holidays override weekly workdays in both salary modes', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 4000,
    calendarOverrides: { '2024-02-01': false } };
  const holiday = new Date('2024-02-01T17:00:00');
  assert.equal(isWorkday(settings, holiday), false);
  assert.equal(countMonthWorkdays(settings, holiday), 20);
  const result = calculate(settings, holiday);
  assert.equal(result.status, 'off');
  assert.equal(result.earned, 0);
  assert.equal(result.dayTotal, 0);
  assert.equal(result.remainingMs, 0);
  assert.equal(result.effectiveDailySalary, 200);
  assert.equal(countWorkMs(settings, new Date('2024-02-01T08:30:00'), holiday), 0);
  near(monthlyEarnings(settings, new Date('2024-02-02T12:45:00')), 100);
  assert.equal(calculate({ ...settings, salaryMode: 'daily' }, holiday).earned, 0);
});

test('a month fully marked as rest has a zero rate without NaN or Infinity', () => {
  const calendarOverrides = Object.fromEntries(Array.from({ length: 29 }, (_, index) =>
    [`2024-02-${String(index + 1).padStart(2, '0')}`, false]));
  const settings = { salaryMode: 'monthly', calendarOverrides };
  const lastDay = new Date('2024-02-29T17:00:00');
  assert.deepEqual(validateSettings(settings), []);
  assert.equal(countMonthWorkdays(settings, lastDay), 0);
  assert.equal(dailyRate(settings, lastDay), 0);
  const result = calculate(settings, lastDay);
  assert.equal(result.status, 'off');
  for (const key of ['earned', 'dayTotal', 'hourlyRate', 'secondRate', 'effectiveDailySalary', 'monthWorkdays']) {
    assert.equal(result[key], 0, key);
  }
  assert.equal(monthlyEarnings(settings, lastDay), 0);
  assert.equal(countWorkMs(settings, new Date('2024-02-01T00:00:00'), new Date('2024-03-01T00:00:00')), 0);
});

test('monthly mode recalculates the rate after a month change and excludes old records', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 4830 };
  const january = new Date('2024-01-31T17:00:00');
  const february = new Date('2024-02-01T12:45:00');
  assert.equal(countMonthWorkdays(settings, january), 23);
  assert.equal(countMonthWorkdays(settings, february), 21);
  assert.equal(dailyRate(settings, january), 210);
  assert.equal(dailyRate(settings, february), 230);
  near(monthlyEarnings(settings, january), 4830);
  const records = { '2024-01-31': { pausedAt: new Date('2024-01-31T08:30:00').getTime() } };
  near(monthlyEarnings(settings, new Date('2024-02-01T00:00:00'), records), 0);
  near(monthlyEarnings(settings, february, records), 115);
});

test('monthly mode retains unpaid lunch, reset, pause, and resumed-work exclusions', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 3150, breakEnabled: true };
  const day = clock => new Date(`2024-02-01T${clock}`);
  const excludedMs = countWorkMs(settings, day('11:30:00'), day('13:30:00'));
  assert.equal(excludedMs, HOUR);
  const resumed = calculate(settings, day('14:00:00'), { excludedMs });
  assert.equal(resumed.workedMs, 3.5 * HOUR);
  near(resumed.earned, 70);
  const record = { resetAt: day('11:30:00').getTime(), pausedAt: day('14:00:00').getTime(), excludedMs: 30 * MINUTE };
  const finished = calculate(settings, day('18:00:00'), record);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.workedMs, HOUR);
  near(finished.earned, 20);
  near(monthlyEarnings(settings, new Date('2024-02-02T12:00:00'), { '2024-02-01': record }), 90);
});

test('calendar overrides must be exact real dates with boolean values', () => {
  for (const calendarOverrides of [
    null, [], '2024-02-01', new Date('2024-02-01'), new Map(),
    { '2024-2-01': true }, { '2024-02-1': true }, { '2023-02-29': true },
    { '2024-02-30': true }, { '2024-04-31': true }, { '2024-00-01': true },
    { '0000-01-01': true }, { '2024-02-01T00:00:00': true },
    { '2024-02-01': 1 }, { '2024-02-01': 'false' }, { '2024-02-01': null },
    { [Symbol('2024-02-01')]: true },
  ]) {
    assert.ok(validateSettings({ calendarOverrides }).length, String(calendarOverrides));
    assert.throws(() => calculate({ calendarOverrides }, date('10:00:00')), RangeError);
  }
  assert.deepEqual(validateSettings({ calendarOverrides: { '2024-02-29': false, '2024-12-31': true } }), []);
});

test('salary modes and monthly amounts reject malformed or nonpositive settings', () => {
  for (const settings of [
    { salaryMode: 'week' }, { salaryMode: '' }, { salaryMode: null },
    { monthlySalary: 0 }, { monthlySalary: -1 }, { monthlySalary: Infinity },
    { monthlySalary: NaN }, { monthlySalary: '5000' },
  ]) {
    assert.ok(validateSettings(settings).length);
    assert.throws(() => dailyRate(settings, date('10:00:00')), RangeError);
  }
});

test('official schedule uses published 2026 dates, holiday names, and local calendar boundaries', () => {
  assert.deepEqual(HOLIDAY_YEARS, [2026]);
  assert.equal(HOLIDAY_SOURCE_URL, 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm');
  for (const [day, name] of [
    ['2026-01-01', '元旦'], ['2026-01-03', '元旦'],
    ['2026-02-15', '春节'], ['2026-02-23', '春节'],
    ['2026-04-04', '清明节'], ['2026-04-06', '清明节'],
    ['2026-05-01', '劳动节'], ['2026-05-05', '劳动节'],
    ['2026-06-19', '端午节'], ['2026-06-21', '端午节'],
    ['2026-09-25', '中秋节'], ['2026-09-27', '中秋节'],
    ['2026-10-01', '国庆节'], ['2026-10-07', '国庆节'],
  ]) {
    for (const value of [day, new Date(`${day}T00:01:00`), new Date(`${day}T23:59:00`)]) {
      assert.deepEqual(getOfficialDay(value), { work: false, name, label: '放假' });
    }
  }
  for (const [day, name] of [
    ['2026-01-04', '元旦'], ['2026-02-14', '春节'], ['2026-02-28', '春节'],
    ['2026-05-09', '劳动节'], ['2026-09-20', '国庆节'], ['2026-10-10', '国庆节'],
  ]) {
    assert.deepEqual(getOfficialDay(day), { work: true, name, label: '补班' });
    assert.equal(isWorkday({}, new Date(`${day}T12:00:00`)), true);
  }
  for (const day of ['2026-01-05', '2026-02-24', '2026-04-07', '2026-05-06',
    '2026-06-22', '2026-09-28', '2026-10-08']) assert.equal(getOfficialDay(day), null);
  assert.throws(() => getOfficialDay('2026-02-30'), RangeError);
});

test('official calendar gives February 16 workdays, October 18, and correct full-year monthly divisors', () => {
  const expected = [21, 16, 22, 21, 19, 21, 23, 21, 22, 18, 21, 23];
  const settings = { salaryMode: 'monthly', monthlySalary: 4800 };
  expected.forEach((days, month) => {
    const end = new Date(2026, month + 1, 0, 23, 59, 59, 999);
    assert.equal(countMonthWorkdays(settings, end), days, `month ${month + 1}`);
    near(dailyRate(settings, end), 4800 / days);
    near(monthlyEarnings(settings, end), 4800);
  });
});

test('National Day holiday earns no work progress and October 10 makeup shift earns a full day', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 5400 };
  const holiday = new Date('2026-10-01T17:00:00');
  const makeup = new Date('2026-10-10T17:00:00');
  assert.deepEqual(getCalendarDay(settings, holiday), {
    work: false, source: 'official', label: '放假', name: '国庆节',
  });
  const off = calculate(settings, holiday);
  assert.equal(off.status, 'off');
  assert.equal(off.earned, 0);
  assert.equal(off.workedMs, 0);
  assert.equal(off.remainingMs, 0);
  assert.equal(off.dayTotal, 0);
  assert.equal(countWorkMs(settings, new Date('2026-10-01T00:00:00'), new Date('2026-10-08T00:00:00')), 0);
  assert.deepEqual(getCalendarDay(settings, makeup), {
    work: true, source: 'official', label: '补班', name: '国庆节',
  });
  const worked = calculate(settings, makeup);
  assert.equal(worked.status, 'finished');
  assert.equal(worked.earned, 300);
  assert.equal(worked.dayTotal, 300);
  assert.equal(worked.workedMs, 8.5 * HOUR);
  assert.equal(calculate({}, makeup).earned, 120);
  assert.equal(monthlyEarnings(settings, makeup), 900);
});

test('manual date changes override official holidays and official makeup days', () => {
  const holiday = new Date('2026-02-16T17:00:00');
  const makeup = new Date('2026-02-14T17:00:00');
  const workOnHoliday = { salaryMode: 'monthly', monthlySalary: 5100,
    calendarOverrides: { '2026-02-16': true } };
  assert.deepEqual(getCalendarDay(workOnHoliday, holiday), { work: true, source: 'manual', label: '补班' });
  assert.equal(countMonthWorkdays(workOnHoliday, holiday), 17);
  assert.equal(calculate(workOnHoliday, holiday).earned, 300);
  assert.equal(countWorkMs(workOnHoliday, new Date('2026-02-16T08:30:00'), holiday), 8.5 * HOUR);

  const restOnMakeup = { salaryMode: 'monthly', monthlySalary: 4500,
    calendarOverrides: { '2026-02-14': false } };
  assert.deepEqual(getCalendarDay(restOnMakeup, makeup), { work: false, source: 'manual', label: '放假' });
  assert.equal(countMonthWorkdays(restOnMakeup, makeup), 15);
  assert.equal(calculate(restOnMakeup, makeup).earned, 0);
  assert.equal(countWorkMs(restOnMakeup, new Date('2026-02-14T08:30:00'), makeup), 0);
  near(monthlyEarnings(restOnMakeup, new Date('2026-02-28T17:00:00')), 4500);
});

test('disabling official holidays restores weekly schedule while preserving manual exceptions', () => {
  const settings = { useChinaHolidays: false };
  const holiday = new Date('2026-10-01T17:00:00');
  const makeup = new Date('2026-10-10T17:00:00');
  assert.deepEqual(getCalendarDay(settings, holiday), { work: true, source: 'weekly', label: '上班' });
  assert.deepEqual(getCalendarDay(settings, makeup), { work: false, source: 'weekly', label: '休息' });
  assert.equal(countMonthWorkdays(settings, holiday), 22);
  assert.equal(countMonthWorkdays(settings, new Date('2026-02-01T12:00:00')), 20);
  assert.equal(calculate(settings, holiday).earned, 120);
  assert.equal(calculate(settings, makeup).earned, 0);
  const manual = { ...settings, calendarOverrides: { '2026-10-01': false, '2026-10-10': true } };
  assert.equal(calculate(manual, holiday).earned, 0);
  assert.equal(calculate(manual, makeup).earned, 120);
  assert.deepEqual(getCalendarDay({ workdays: [0] }, holiday), {
    work: false, source: 'official', label: '放假', name: '国庆节',
  });
  assert.equal(isWorkday({ workdays: [0] }, makeup), true);
});

test('unpublished years fall back to weekly schedule without guessing holidays', () => {
  const monday = new Date('2027-02-15T17:00:00');
  const saturday = new Date('2027-02-20T17:00:00');
  assert.equal(getOfficialDay(monday), null);
  assert.equal(getOfficialDay(saturday), null);
  assert.deepEqual(getCalendarDay({}, monday), { work: true, source: 'weekly', label: '上班' });
  assert.deepEqual(getCalendarDay({}, saturday), { work: false, source: 'weekly', label: '休息' });
  assert.equal(countMonthWorkdays({}, monday), 20);
  assert.equal(calculate({}, monday).earned, 120);
  assert.equal(calculate({ calendarOverrides: { '2027-02-20': true } }, saturday).earned, 120);
});

test('pause intervals spanning Spring Festival skip all holiday hours and include makeup shifts', () => {
  const start = new Date('2026-02-13T16:00:00');
  const end = new Date('2026-02-24T09:30:00');
  assert.equal(countWorkMs({}, start, end), 10.5 * HOUR);
  assert.equal(countWorkMs({ breakEnabled: true }, start, end), 9.5 * HOUR);
  assert.equal(countWorkMs({}, new Date('2026-02-15T00:00:00'), new Date('2026-02-24T00:00:00')), 0);
  const settings = { salaryMode: 'monthly', monthlySalary: 4800 };
  const records = { '2026-02-14': { pausedAt: new Date('2026-02-14T12:45:00').getTime() } };
  near(monthlyEarnings(settings, new Date('2026-02-28T17:00:00'), records), 4650);
  assert.equal(calculate(settings, new Date('2026-02-16T12:00:00'), {
    pausedAt: new Date('2026-02-16T10:00:00').getTime(),
  }).earned, 0);
});

test('holiday-aware interval counting and salary rates remain correct across month boundaries', () => {
  const settings = { salaryMode: 'monthly', monthlySalary: 3990 };
  const april = new Date('2026-04-30T17:00:00');
  const mayHoliday = new Date('2026-05-01T17:00:00');
  assert.equal(dailyRate(settings, april), 190);
  assert.equal(dailyRate(settings, mayHoliday), 210);
  near(monthlyEarnings(settings, april), 3990);
  assert.equal(monthlyEarnings(settings, mayHoliday), 0);
  near(monthlyEarnings(settings, new Date('2026-05-06T12:45:00')), 105);
  assert.equal(countWorkMs(settings, new Date('2026-04-30T16:00:00'), new Date('2026-05-09T09:30:00')), 27.5 * HOUR);
  near(monthlyEarnings(settings, new Date('2026-05-31T23:59:00'), {
    '2026-04-30': { excludedMs: 8.5 * HOUR },
  }), 3990);
});

test('official schedule is enabled for legacy settings and rejects malformed toggle values', () => {
  assert.equal(DEFAULT_SETTINGS.useChinaHolidays, true);
  assert.equal(calculate({ dailySalary: 180 }, new Date('2026-10-01T17:00:00')).earned, 0);
  for (const useChinaHolidays of ['true', 'false', 0, 1, null, undefined]) {
    assert.ok(validateSettings({ useChinaHolidays }).length);
    assert.throws(() => getCalendarDay({ useChinaHolidays }, date('10:00:00')), RangeError);
  }
});

test('calendar previews tolerate unfinished salary fields and an empty draft workweek', () => {
  const draft = { dailySalary: '', monthlySalary: '', goalName: '', goalAmount: '', workdays: [] };
  assert.deepEqual(getCalendarDay(draft, new Date('2026-10-01T12:00:00')), {
    work: false, source: 'official', label: '放假', name: '国庆节',
  });
  assert.deepEqual(getCalendarDay(draft, new Date('2026-10-10T12:00:00')), {
    work: true, source: 'official', label: '补班', name: '国庆节',
  });
  assert.deepEqual(getCalendarDay(draft, new Date('2026-11-03T12:00:00')), {
    work: false, source: 'weekly', label: '休息',
  });
  assert.deepEqual(getCalendarDay({ ...draft, calendarOverrides: { '2026-10-10': false } }, new Date('2026-10-10T12:00:00')), {
    work: false, source: 'manual', label: '放假',
  });
  assert.ok(validateSettings(draft).length);
  assert.throws(() => calculate(draft, date('12:00:00')), RangeError);
  assert.throws(() => isWorkday(draft, date('12:00:00')), RangeError);
  assert.throws(() => getCalendarDay({ ...draft, calendarOverrides: { '2026-02-30': true } }, date('12:00:00')), RangeError);
});
