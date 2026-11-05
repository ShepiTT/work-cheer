/** Published State Council holiday and makeup-work schedule only.
 * Source: 国务院办公厅关于2026年部分节假日安排的通知
 * 国办发明电〔2025〕7号, published 2025-11-04.
 * Other years deliberately fall back to the user's weekly schedule.
 */
export const HOLIDAY_SOURCE_URL = 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm';
export const HOLIDAY_YEARS = Object.freeze([2026]);

const days = new Map();
const keyFor = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

for (const [month, start, end, name] of [
  [1, 1, 3, '元旦'],
  [2, 15, 23, '春节'],
  [4, 4, 6, '清明节'],
  [5, 1, 5, '劳动节'],
  [6, 19, 21, '端午节'],
  [9, 25, 27, '中秋节'],
  [10, 1, 7, '国庆节'],
]) {
  const entry = Object.freeze({ work: false, name, label: '放假' });
  for (let day = start; day <= end; day += 1) days.set(keyFor(2026, month, day), entry);
}

for (const [month, day, name] of [
  [1, 4, '元旦'],
  [2, 14, '春节'],
  [2, 28, '春节'],
  [5, 9, '劳动节'],
  [9, 20, '国庆节'],
  [10, 10, '国庆节'],
]) {
  days.set(keyFor(2026, month, day), Object.freeze({ work: true, name, label: '补班' }));
}

/** A local-calendar date's official exception, or null if none is published here. */
export function getOfficialDay(value) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Date-only input is a local calendar label, not a UTC midnight timestamp.
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new RangeError('无效的日期');
    }
  } else {
    date = value instanceof Date ? value : new Date(value);
  }
  if (!Number.isFinite(date.getTime())) throw new RangeError('无效的日期');
  return days.get(keyFor(date.getFullYear(), date.getMonth() + 1, date.getDate())) ?? null;
}
