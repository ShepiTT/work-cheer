import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  LANGUAGES, DEFAULT_LANGUAGE, getTranslation, normalizeLanguage, isValidLanguage 
} from '../src/i18n.js';

test('LANGUAGES contains both Chinese and English', () => {
  assert.ok(LANGUAGES.some(l => l.id === 'zh'));
  assert.ok(LANGUAGES.some(l => l.id === 'en'));
  assert.equal(LANGUAGES.length, 2);
});

test('DEFAULT_LANGUAGE is Chinese', () => {
  assert.equal(DEFAULT_LANGUAGE, 'zh');
});

test('isValidLanguage validates correctly', () => {
  assert.ok(isValidLanguage('zh'));
  assert.ok(isValidLanguage('en'));
  assert.ok(!isValidLanguage('fr'));
  assert.ok(!isValidLanguage(''));
  assert.ok(!isValidLanguage(null));
  assert.ok(!isValidLanguage(undefined));
});

test('normalizeLanguage returns valid language or default', () => {
  assert.equal(normalizeLanguage('zh'), 'zh');
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('fr'), 'zh');
  assert.equal(normalizeLanguage(''), 'zh');
  assert.equal(normalizeLanguage(null), 'zh');
  assert.equal(normalizeLanguage(undefined), 'zh');
});

test('getTranslation returns translation object', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  assert.ok(zh.appTitle);
  assert.ok(en.appTitle);
  assert.notEqual(zh.appTitle, en.appTitle);
  
  assert.equal(zh.appTitle, '上班鼓励器');
  assert.equal(en.appTitle, 'Work Cheer');
});

test('all Chinese keys exist in English', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  for (const key of Object.keys(zh)) {
    assert.ok(en[key] !== undefined, `English missing key: ${key}`);
  }
});

test('all English keys exist in Chinese', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  for (const key of Object.keys(en)) {
    assert.ok(zh[key] !== undefined, `Chinese missing key: ${key}`);
  }
});

test('translation functions work correctly', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  assert.ok(typeof zh.dateFormat === 'function');
  assert.ok(typeof en.dateFormat === 'function');
  
  assert.equal(zh.dateFormat(11, 19), '11月19日');
  assert.equal(en.dateFormat(11, 19), 'Nov 19');
  
  assert.ok(typeof zh.timeFormat === 'function');
  assert.ok(typeof en.timeFormat === 'function');
  
  assert.equal(zh.timeFormat(2, 30), '2小时30分钟');
  assert.equal(en.timeFormat(2, 30), '2h 30min');
  assert.equal(zh.timeFormat(0, 45), '45分钟');
  assert.equal(en.timeFormat(0, 45), '45 min');
});

test('encouragement functions return arrays', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  const zhRest = zh.encourageRestDay('Coffee');
  const enRest = en.encourageRestDay('Coffee');
  
  assert.ok(Array.isArray(zhRest));
  assert.ok(Array.isArray(enRest));
  assert.equal(zhRest.length, 3);
  assert.equal(enRest.length, 3);
  
  const zhWorking = zh.encourageWorking('30分钟', '一杯咖啡');
  const enWorking = en.encourageWorking('30 min', 'Coffee');
  
  assert.ok(Array.isArray(zhWorking));
  assert.ok(Array.isArray(enWorking));
});

test('goal-related translations exist in both languages', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  assert.ok(zh.goalLabel);
  assert.ok(en.goalLabel);
  assert.ok(zh.miniGoal);
  assert.ok(en.miniGoal);
  assert.ok(zh.editGoal);
  assert.ok(en.editGoal);
  assert.ok(zh.goalSection);
  assert.ok(en.goalSection);
  assert.ok(zh.goalName);
  assert.ok(en.goalName);
  assert.ok(zh.goalAmount);
  assert.ok(en.goalAmount);
});

test('weekdays arrays have correct length', () => {
  const zh = getTranslation('zh');
  const en = getTranslation('en');
  
  assert.equal(zh.weekdays.length, 7);
  assert.equal(en.weekdays.length, 7);
  assert.equal(zh.weekdaysFull.length, 7);
  assert.equal(en.weekdaysFull.length, 7);
});

test('month format function works for all months', () => {
  const en = getTranslation('en');
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = 1; m <= 12; m++) {
    const result = en.monthFormat(2026, m);
    assert.ok(result.includes(months[m - 1]), `Month ${m} format: ${result}`);
  }
});

test('invalid language falls back to Chinese', () => {
  const invalid = getTranslation('invalid');
  const zh = getTranslation('zh');
  
  assert.equal(invalid.appTitle, zh.appTitle);
});
