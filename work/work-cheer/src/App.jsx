import React, { useEffect, useState, createContext, useContext } from 'react';
import { GearSix, Check, Pause, Play, ArrowCounterClockwise, Coffee, PictureInPicture, DotsThree, Minus, Square, Copy, X, PencilSimple } from '@phosphor-icons/react';
import { DEFAULT_SETTINGS, calculate, monthlyEarnings, countWorkMs, dateKey, validateSettings, getCalendarDay } from './calculator.js';

import { Modal } from './Modal.jsx';
import { Settings } from './Settings.jsx';
import { applyLook, prefersDarkScheme } from './themes.js';
import { DEFAULT_LANGUAGE, normalizeLanguage, getTranslation } from './i18n.js';

const STORAGE_KEY = 'work-cheer-v1';
const EMPTY_RECORD = { excludedMs: 0, pausedAt: null, resetAt: null };
const HOUR = 3600000;

export const LanguageContext = createContext(DEFAULT_LANGUAGE);
// Set only by the Windows app's window preload: a frameless window whose title bar the page draws.
const desktopWindow = typeof window === 'undefined' ? undefined : window.workCheerWindow;
function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.version === 1 && !validateSettings(stored.settings).length) {
      const records = Object.fromEntries(Object.entries(stored.records || {}).filter(([key, r]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && r && Number.isFinite(r.excludedMs) && r.excludedMs >= 0 && (r.pausedAt == null || Number.isFinite(r.pausedAt)) && (r.resetAt == null || Number.isFinite(r.resetAt))));
      const settings = { ...DEFAULT_SETTINGS, ...stored.settings };
      if (!settings.language) settings.language = DEFAULT_LANGUAGE;
      return { settings, records };
    }
  } catch { /* Fall back to defaults for unavailable or damaged storage. */ }
  return { settings: { ...DEFAULT_SETTINGS, language: DEFAULT_LANGUAGE }, records: {} };
}
function duration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
const money = n => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function useLanguage() { return useContext(LanguageContext); }

function usePrefersDark() {
  const [dark, setDark] = useState(prefersDarkScheme);
  useEffect(() => {
    let query;
    try { query = window.matchMedia('(prefers-color-scheme: dark)'); } catch { return undefined; }
    const update = () => setDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return dark;
}

/** Windows app only: transparent title bar so the theme runs to the top edge; the bar itself drags the window. */
function WindowBar() {
  const lang = useLanguage();
  const T = getTranslation(lang);
  const [maximized, setMaximized] = useState(false);
  useEffect(() => desktopWindow.onMaximizedChange(setMaximized), []);
  const tool = (label, run, icon, className = '') => <button type="button" className={className} title={label} aria-label={label} onClick={() => run()}>{icon}</button>;
  return <div className="window-bar"><div className="window-controls">
    {tool(T.floatingWidget, desktopWindow.floating, <PictureInPicture size={17}/>, 'window-tool')}
    {tool(T.more, desktopWindow.menu, <DotsThree size={18} weight="bold"/>, 'window-tool')}
    <span className="window-divider" aria-hidden="true"/>
    {tool(T.minimize, desktopWindow.minimize, <Minus size={15} weight="light"/>)}
    {tool(maximized ? T.restore : T.maximize, desktopWindow.toggleMaximize, maximized ? <Copy size={14} weight="light"/> : <Square size={13} weight="light"/>)}
    {tool(T.close, desktopWindow.close, <X size={15} weight="light"/>, 'window-close')}
  </div></div>;
}

/** Activity-style rings for the 小组件 theme: outer = today's hours, inner = the goal. */
function Rings({ work, goal }) {
  const lang = useLanguage();
  const workLabel = lang === 'en' ? 'Hours' : '工时';
  const goalLabel = lang === 'en' ? 'Goal' : '目标';
  const ring = (name, radius, value) => <g key={name} className={'ring-' + name}><circle className="ring-track" cx="60" cy="60" r={radius} pathLength="100"/><circle className="ring-fill" cx="60" cy="60" r={radius} pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - value} transform="rotate(-90 60 60)" opacity={value > 0 ? 1 : 0}/></g>;
  return <section className="rings-tile" aria-hidden="true"><svg className="rings" viewBox="0 0 120 120">{ring('work', 50, work)}{ring('goal', 36, goal)}</svg>
    <div className="rings-legend"><span><i className="key-work"/>{workLabel} <b>{Math.floor(work)}%</b></span><span><i className="key-goal"/>{goalLabel} <b>{Math.floor(goal)}%</b></span></div></section>;
}

/** One cell per scheduled work hour; a partial last hour gets a shorter cell. */
function HourCells({ workedMs, totalMs, percent }) {
  const lang = useLanguage();
  const T = getTranslation(lang);
  const hours = totalMs / HOUR, worked = workedMs / HOUR;
  const count = Math.max(1, Math.ceil(hours - 1e-6));
  return <div role="progressbar" aria-label={T.progressLabel} aria-valuenow={Number(percent.toFixed(1))} aria-valuemin={0} aria-valuemax={100} className="hour-cells">
    {Array.from({ length: count }, (_, i) => {
      const size = Math.min(1, hours - i) || 1;
      return <span key={i} style={{ flexGrow: size, '--fill': Math.min(1, Math.max(0, (worked - i) / size)) }}/>;
    })}
  </div>;
}

export function App() {
  const [data, setData] = useState(loadData);
  const [now, setNow] = useState(() => new Date());
  const [modal, setModal] = useState(null);
  const [previewLook, setPreviewLook] = useState(null);
  const [toast, setToast] = useState('');
  const [storageProblem, setStorageProblem] = useState(false);
  const prefersDark = usePrefersDark();
  const { settings, records } = data;
  const lang = normalizeLanguage(settings.language);
  const T = getTranslation(lang);
  useEffect(() => { applyLook(previewLook || settings, prefersDark); }, [previewLook, settings, prefersDark]);
  useEffect(() => { 
    document.documentElement.lang = lang;
    if (desktopWindow?.setLanguage) desktopWindow.setLanguage(lang);
  }, [lang]);
  const key = dateKey(now);
  const record = records[key] || EMPTY_RECORD;
  const stats = calculate(settings, now, record);
  const calendarDay = getCalendarDay(settings,now);
  const month = monthlyEarnings(settings, now, records);
  const countdown = duration(stats.countdownMs);
  const countdownHeading = { start: T.countdownToWork, lunch: T.countdownToLunch, afternoon: T.countdownToAfternoon, end: settings.splitCountdown ? T.countdownToEndSplit : T.countdownToEnd }[stats.countdownPhase];
  const progress = stats.progress * 100;
  const [whole, fraction] = stats.earned.toFixed(4).split('.');
  const goalReached = stats.earned >= settings.goalAmount;
  const goalPercent = Math.min(100, stats.earned / settings.goalAmount * 100);
  const labels = { 
    before: T.statusBefore, 
    working: stats.countdownPhase==='afternoon' ? T.statusBreak : calendarDay.label==='补班' ? T.statusMakeup : T.statusWorking, 
    break: T.statusBreak, 
    finished: T.statusFinished, 
    off: calendarDay.label==='放假' ? T.statusHoliday : T.statusOff, 
    paused: T.statusPaused 
  };
  const rateNotes = { before: T.rateBeforeWork, break: T.rateOnBreak, paused: T.ratePaused, finished: T.rateFinished, off: T.rateOffDay };
  const canPause = ['working', 'break', 'paused'].includes(stats.status);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data })); setStorageProblem(false); } catch { setStorageProblem(true); } }, [data]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);
  function changeRecord(next) { setData(d => ({ ...d, records: { ...d.records, [key]: { ...record, ...next } } })); }
  function toggleTimer() {
    const time = new Date();
    if (record.pausedAt != null) {
      changeRecord({ excludedMs: record.excludedMs + countWorkMs(settings, new Date(record.pausedAt), time), pausedAt: null });
      setToast(T.toastContinued);
    } else { changeRecord({ pausedAt: time.getTime() }); setToast(T.toastPaused); }
    setNow(time);
  }
  function saveSettings(next) {
    const time = new Date();
    const nextRecords = { ...records };
    if (record.pausedAt != null) nextRecords[key] = { ...record, excludedMs: record.excludedMs + countWorkMs(settings, new Date(record.pausedAt), time), pausedAt: time.getTime() };
    const nextT = getTranslation(normalizeLanguage(next.language));
    setData({ settings: next, records: nextRecords }); setPreviewLook(null); setModal(null); setNow(time); setToast(nextT.toastSaved);
  }
  function resetToday() { const time = Date.now(); changeRecord({ excludedMs: 0, resetAt: time, pausedAt: record.pausedAt != null ? time : null }); setNow(new Date(time)); setModal(null); setToast(T.toastReset); }
  let encouragementParts;
  if (stats.status === 'off') encouragementParts = T.encourageRestDay(settings.goalName);
  else if (goalReached) encouragementParts = T.encourageGoalReached(settings.goalName);
  else if (stats.status === 'paused') encouragementParts = T.encouragePaused();
  else if (stats.status === 'finished') encouragementParts = T.encourageFinished(money(stats.earned));
  else if (stats.secondRate <= 0) {
    encouragementParts = T.encourageWorking('--', settings.goalName);
  } else {
    const remaining = settings.goalAmount - stats.earned;
    const minutes = remaining > 0 ? Math.max(1, Math.ceil(remaining / stats.secondRate / 60)) : 0;
    const timeText = minutes > 0 ? T.timeFormat(Math.floor(minutes / 60), minutes % 60) : '--';
    encouragementParts = T.encourageWorking(timeText, settings.goalName);
  }
  const encouragement = <>{encouragementParts[0]}<strong>{encouragementParts[1]}</strong>{encouragementParts[2]}</>;
  function openGoalSettings() { setModal('settings'); setTimeout(() => document.getElementById('settings-tab-0')?.click(), 50); }
  const dateDisplay = T.dateFormat(now.getMonth() + 1, now.getDate());
  const weekdayDisplay = lang === 'en' ? T.weekdays[now.getDay()] : T.weekdayPrefix + T.weekdays[now.getDay()];
  return <LanguageContext.Provider value={lang}>
  <main className={'page' + (desktopWindow ? ' with-window-bar' : '') + (modal ? ' modal-open' : '')} data-lang={lang}>
    {desktopWindow && <WindowBar/>}
    <article className="work-card" aria-labelledby="app-title">
      <header className="card-header"><div className="brand"><span className="seal" aria-hidden="true">{T.seal}</span><h1 id="app-title">{T.appTitle}</h1></div><button className="settings-button" onClick={() => setModal('settings')}><GearSix size={17}/><span>{T.settings}</span></button></header>
      <div className="date-row"><time dateTime={now.toISOString()}>{dateDisplay}<span className="weekday">{weekdayDisplay}</span></time><span className="clock" data-ghost="88:88:88">{now.toLocaleTimeString(lang === 'en' ? 'en-US' : 'zh-CN', { hour12: false })}</span><span className={'status ' + stats.status}><i aria-hidden="true"/>{labels[stats.status]}</span></div>
      <section className="income-section" aria-label={T.todayEarned}><p className="eyebrow">{T.todayEarned}</p>
        <div className={'income' + (whole.length > 6 ? ' very-large-amount' : whole.length > 4 ? ' large-amount' : '')}><span className="currency">¥</span><span className="income-value"><span className="income-whole" data-ghost={whole.replace(/\d/g, '8')}>{whole}</span><span className="income-fraction" data-ghost=".8888">.{fraction}</span></span></div>
        <p className="rate">{stats.status === 'working' ? <>{T.perSecond} <strong>+¥{stats.secondRate.toFixed(4)}</strong></> : rateNotes[stats.status]}</p>
        {settings.salaryMode === 'monthly' && <p className="salary-basis">{T.monthlySalaryBasis(money(settings.monthlySalary), stats.monthWorkdays)}</p>}
      </section>
      <section className="time-section" aria-label={T.countdownToEnd}>
        <div className="time-head"><div className="time-main"><p className="eyebrow">{stats.status === 'off' ? T.offDayMessage : stats.status === 'finished' ? T.finishedMessage : countdownHeading}</p>
          {stats.status === 'off' ? <div className="countdown rest">{T.offDayRest}<Coffee size={26}/></div> : stats.status === 'finished' ? <div className="countdown finished-text">{T.finishedText}</div> : <div className="countdown" data-label={stats.countdownLabel} data-phase={stats.countdownPhase}><span data-ghost={String(countdown.hours).replace(/\d/g, '8')}>{countdown.hours}</span><small>{T.hours}</small><span data-ghost="88">{countdown.minutes.toString().padStart(2, '0')}</span><small>{T.minutes}</small><span data-ghost="88">{countdown.seconds.toString().padStart(2, '0')}</span><small>{T.seconds}</small></div>}
        </div>{stats.status !== 'off' && <p className="day-percent" data-ghost={progress.toFixed(1).replace(/\d/g, '8')} aria-hidden="true">{progress.toFixed(1)}<small>%</small></p>}</div>
        {stats.status !== 'off' && <><HourCells workedMs={stats.workedMs} totalMs={stats.totalMs} percent={progress}/>
        <div className="day-scale"><span>{settings.startTime}</span><span className="hours">{T.workedHours((stats.workedMs / HOUR).toFixed(2), (stats.totalMs / HOUR).toFixed(2))}</span><span>{settings.endTime}</span></div></>}
      </section>
      <Rings work={Math.min(100, progress)} goal={stats.status === 'off' ? 0 : goalPercent}/>
      <section className={'goal' + (goalReached ? ' reached' : '')} aria-label={T.goalLabel}>
        <div className="goal-head"><span className="goal-name">{goalReached && <Check size={14} weight="bold"/>}{T.miniGoal} · <b>{settings.goalName}</b><button type="button" className="goal-edit" onClick={openGoalSettings} aria-label={T.editGoal} title={T.editGoal}><PencilSimple size={13} weight="bold"/></button></span>{stats.status !== 'off' && <span className="goal-amount">¥{money(Math.min(stats.earned, settings.goalAmount))} / ¥{money(settings.goalAmount)}</span>}</div>
        {stats.status !== 'off' && <div className="goal-track" aria-hidden="true"><span style={{ '--goal': goalPercent / 100 }}/></div>}
        <p className="encouragement">{encouragement}</p>
      </section>
      <div className="timer-controls"><button className="primary-button" onClick={toggleTimer} disabled={!canPause}>{stats.status === 'paused' ? <Play size={18} weight="fill"/> : canPause ? <Pause size={18} weight="fill"/> : null}{stats.status === 'paused' ? T.continueTimer : stats.status === 'off' ? T.restToday : stats.status === 'finished' ? T.hardWorkToday : stats.status === 'before' ? T.autoStartTimer : T.pauseTimer}</button><button className="reset-button" onClick={() => setModal('reset')} aria-label={T.resetTitle} title={T.resetTitle}><ArrowCounterClockwise size={16}/>{T.resetLabel}</button></div>
      <dl className="summary"><div><dt>{T.monthlyTotal}<span className="estimate-label">{T.estimate}</span></dt><dd>¥{money(month)}</dd></div><div><dt>{T.hourlyRate}</dt><dd>¥{money(stats.hourlyRate)}</dd></div><div><dt>{T.dailyFull}</dt><dd>¥{money(stats.dayTotal)}</dd></div></dl>
      <p className="card-footnote">{T.cardFootnote}</p>
    </article>
    <p className="page-note">{storageProblem ? T.storageWarning : T.pageNote}<span>{T.localStorageNote}</span></p>
    {modal === 'settings' && <Settings settings={settings} onSave={saveSettings} onPreviewTheme={setPreviewLook} onClose={() => {setPreviewLook(null);setModal(null);}} lang={lang}/>}
    {modal === 'reset' && <Modal title={T.resetModalTitle} onClose={() => setModal(null)} className="confirm-modal"><div className="modal-content"><p className="confirm-copy">{T.resetModalContent}</p></div><div className="confirm-actions"><button className="secondary-button" onClick={() => setModal(null)}>{T.cancel}</button><button className="primary-button" onClick={resetToday}>{T.confirmReset}</button></div></Modal>}
    {toast && <div role="status" className="toast"><Check size={16}/>{toast}</div>}
  </main>
  </LanguageContext.Provider>;
}
