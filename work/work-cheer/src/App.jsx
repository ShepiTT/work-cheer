import React, { useEffect, useState } from 'react';
import { GearSix, Check, Pause, Play, ArrowCounterClockwise, Coffee, PictureInPicture, DotsThree, Minus, Square, Copy, X } from '@phosphor-icons/react';
import { DEFAULT_SETTINGS, calculate, monthlyEarnings, countWorkMs, dateKey, validateSettings, getCalendarDay } from './calculator.js';

import { Modal } from './Modal.jsx';
import { Settings } from './Settings.jsx';
import { applyLook, prefersDarkScheme } from './themes.js';

const STORAGE_KEY = 'work-cheer-v1';
const EMPTY_RECORD = { excludedMs: 0, pausedAt: null, resetAt: null };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const HOUR = 3600000;
// Set only by the Windows app's window preload: a frameless window whose title bar the page draws.
const desktopWindow = typeof window === 'undefined' ? undefined : window.workCheerWindow;
function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.version === 1 && !validateSettings(stored.settings).length) {
      const records = Object.fromEntries(Object.entries(stored.records || {}).filter(([key, r]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && r && Number.isFinite(r.excludedMs) && r.excludedMs >= 0 && (r.pausedAt == null || Number.isFinite(r.pausedAt)) && (r.resetAt == null || Number.isFinite(r.resetAt))));
      return { settings: { ...DEFAULT_SETTINGS, ...stored.settings }, records };
    }
  } catch { /* Fall back to defaults for unavailable or damaged storage. */ }
  return { settings: { ...DEFAULT_SETTINGS }, records: {} };
}
function duration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return { hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
const money = n => Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [maximized, setMaximized] = useState(false);
  useEffect(() => desktopWindow.onMaximizedChange(setMaximized), []);
  const tool = (label, run, icon, className = '') => <button type="button" className={className} title={label} aria-label={label} onClick={() => run()}>{icon}</button>;
  return <div className="window-bar"><div className="window-controls">
    {tool('进入悬浮窗', desktopWindow.floating, <PictureInPicture size={17}/>, 'window-tool')}
    {tool('更多', desktopWindow.menu, <DotsThree size={18} weight="bold"/>, 'window-tool')}
    <span className="window-divider" aria-hidden="true"/>
    {tool('最小化', desktopWindow.minimize, <Minus size={15} weight="light"/>)}
    {tool(maximized ? '还原' : '最大化', desktopWindow.toggleMaximize, maximized ? <Copy size={14} weight="light"/> : <Square size={13} weight="light"/>)}
    {tool('关闭', desktopWindow.close, <X size={15} weight="light"/>, 'window-close')}
  </div></div>;
}

/** Activity-style rings for the 小组件 theme: outer = today's hours, inner = the goal. */
function Rings({ work, goal }) {
  const ring = (name, radius, value) => <g key={name} className={'ring-' + name}><circle className="ring-track" cx="60" cy="60" r={radius} pathLength="100"/><circle className="ring-fill" cx="60" cy="60" r={radius} pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - value} transform="rotate(-90 60 60)" opacity={value > 0 ? 1 : 0}/></g>;
  return <section className="rings-tile" aria-hidden="true"><svg className="rings" viewBox="0 0 120 120">{ring('work', 50, work)}{ring('goal', 36, goal)}</svg>
    <div className="rings-legend"><span><i className="key-work"/>工时 <b>{Math.floor(work)}%</b></span><span><i className="key-goal"/>目标 <b>{Math.floor(goal)}%</b></span></div></section>;
}

/** One cell per scheduled work hour; a partial last hour gets a shorter cell. */
function HourCells({ workedMs, totalMs, percent }) {
  const hours = totalMs / HOUR, worked = workedMs / HOUR;
  const count = Math.max(1, Math.ceil(hours - 1e-6));
  return <div role="progressbar" aria-label="今日工时进度" aria-valuenow={Number(percent.toFixed(1))} aria-valuemin={0} aria-valuemax={100} className="hour-cells">
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
  useEffect(() => { applyLook(previewLook || settings, prefersDark); }, [previewLook, settings, prefersDark]);
  const key = dateKey(now);
  const record = records[key] || EMPTY_RECORD;
  const stats = calculate(settings, now, record);
  const calendarDay = getCalendarDay(settings,now);
  const month = monthlyEarnings(settings, now, records);
  const countdown = duration(stats.remainingMs);
  const progress = stats.progress * 100;
  const [whole, fraction] = stats.earned.toFixed(4).split('.');
  const goalReached = stats.earned >= settings.goalAmount;
  const goalPercent = Math.min(100, stats.earned / settings.goalAmount * 100);
  const labels = { before: '待上班', working: calendarDay.label==='补班'?'调休补班':'上班中', break: '午休中', finished: '已下班', off: calendarDay.label==='放假'?'放假中':'休息日', paused: '已暂停' };
  const rateNotes = { before: '到上班时间后自动开始累计', break: '午休中，收入暂停累计', paused: '已暂停，收入暂停累计', finished: '今天的工时已经走完', off: '今天是休息日' };
  const canPause = ['working', 'break', 'paused'].includes(stats.status);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...data })); setStorageProblem(false); } catch { setStorageProblem(true); } }, [data]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);
  function changeRecord(next) { setData(d => ({ ...d, records: { ...d.records, [key]: { ...record, ...next } } })); }
  function toggleTimer() {
    const time = new Date();
    if (record.pausedAt != null) {
      changeRecord({ excludedMs: record.excludedMs + countWorkMs(settings, new Date(record.pausedAt), time), pausedAt: null });
      setToast('已继续计时，每一秒都算数。');
    } else { changeRecord({ pausedAt: time.getTime() }); setToast('已暂停，休息一下也很好。'); }
    setNow(time);
  }
  function saveSettings(next) {
    const time = new Date();
    const nextRecords = { ...records };
    if (record.pausedAt != null) nextRecords[key] = { ...record, excludedMs: record.excludedMs + countWorkMs(settings, new Date(record.pausedAt), time), pausedAt: time.getTime() };
    setData({ settings: next, records: nextRecords }); setPreviewLook(null); setModal(null); setNow(time); setToast('设置已保存，按新设置重新计算。');
  }
  function resetToday() { const time = Date.now(); changeRecord({ excludedMs: 0, resetAt: time, pausedAt: record.pausedAt != null ? time : null }); setNow(new Date(time)); setModal(null); setToast('今日计时已重置。'); }
  let encouragement;
  if (stats.status === 'off') encouragement = <>今天的任务：<strong>好好休息</strong>，快乐也很重要。</>;
  else if (goalReached) encouragement = <>今天的努力，已经赚到<strong>「{settings.goalName}」</strong>了。</>;
  else if (stats.status === 'paused') encouragement = <>稍作停留。<strong>照顾自己</strong>，也是今天的重要任务。</>;
  else if (stats.status === 'finished') encouragement = <>今天已攒下 <strong>¥{money(stats.earned)}</strong>，辛苦啦。</>;
  else {
    const minutes = Math.max(1, Math.ceil((settings.goalAmount - stats.earned) / stats.secondRate / 60));
    const timeText = minutes >= 60 ? Math.floor(minutes / 60) + '小时' + (minutes % 60 ? minutes % 60 + '分钟' : '') : minutes + '分钟';
    encouragement = <>再工作 <strong>{timeText}</strong>，{settings.goalName}就赚回来了。</>;
  }
  return <main className={'page' + (desktopWindow ? ' with-window-bar' : '') + (modal ? ' modal-open' : '')}>
    {desktopWindow && <WindowBar/>}
    <article className="work-card" aria-labelledby="app-title">
      <header className="card-header"><div className="brand"><span className="seal" aria-hidden="true">励</span><h1 id="app-title">上班鼓励器</h1></div><button className="settings-button" onClick={() => setModal('settings')}><GearSix size={17}/><span>设置</span></button></header>
      <div className="date-row"><time dateTime={now.toISOString()}>{now.getMonth() + 1}月{now.getDate()}日<span className="weekday">周{WEEKDAYS[now.getDay()]}</span></time><span className="clock">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span><span className={'status ' + stats.status}><i aria-hidden="true"/>{labels[stats.status]}</span></div>
      <section className="income-section" aria-label="今日收入"><p className="eyebrow">今日已赚</p>
        <div className={'income' + (stats.earned >= 1000000 ? ' very-large-amount' : stats.earned >= 10000 ? ' large-amount' : '')}><span className="currency">¥</span><span className="income-value"><span className="income-whole">{whole}</span><span className="income-fraction">.{fraction}</span></span></div>
        <p className="rate">{stats.status === 'working' ? <>每秒 <strong>+¥{stats.secondRate.toFixed(4)}</strong></> : rateNotes[stats.status]}</p>
        {settings.salaryMode === 'monthly' && <p className="salary-basis">月薪 ¥{money(settings.monthlySalary)} · 本月 {stats.monthWorkdays} 个工作日</p>}
      </section>
      <section className="time-section" aria-label="下班倒计时">
        <div className="time-head"><div className="time-main"><p className="eyebrow">{stats.status === 'off' ? '今天不用赶时间' : stats.status === 'finished' ? '今天的工作已结束' : '距离下班还有'}</p>
          {stats.status === 'off' ? <div className="countdown rest">享受你的休息日<Coffee size={26}/></div> : stats.status === 'finished' ? <div className="countdown finished-text">下班啦，生活继续</div> : <div className="countdown"><span>{countdown.hours}</span><small>小时</small><span>{countdown.minutes.toString().padStart(2, '0')}</span><small>分</small><span>{countdown.seconds.toString().padStart(2, '0')}</span><small>秒</small></div>}
        </div>{stats.status !== 'off' && <p className="day-percent" aria-hidden="true">{progress.toFixed(1)}<small>%</small></p>}</div>
        {stats.status !== 'off' && <><HourCells workedMs={stats.workedMs} totalMs={stats.totalMs} percent={progress}/>
        <div className="day-scale"><span>{settings.startTime}</span><span className="hours">已工作 <strong>{(stats.workedMs / HOUR).toFixed(2)}</strong> / {(stats.totalMs / HOUR).toFixed(2)} 小时</span><span>{settings.endTime}</span></div></>}
      </section>
      <Rings work={Math.min(100, progress)} goal={stats.status === 'off' ? 0 : goalPercent}/>
      <section className={'goal' + (goalReached ? ' reached' : '')} aria-label="今日小目标">
        <div className="goal-head"><span className="goal-name">{goalReached && <Check size={14} weight="bold"/>}小目标 · <b>{settings.goalName}</b></span>{stats.status !== 'off' && <span className="goal-amount">¥{money(Math.min(stats.earned, settings.goalAmount))} / ¥{money(settings.goalAmount)}</span>}</div>
        {stats.status !== 'off' && <div className="goal-track" aria-hidden="true"><span style={{ transform: `scaleX(${goalPercent / 100})` }}/></div>}
        <p className="encouragement">{encouragement}</p>
      </section>
      <div className="timer-controls"><button className="primary-button" onClick={toggleTimer} disabled={!canPause}>{stats.status === 'paused' ? <Play size={18} weight="fill"/> : canPause ? <Pause size={18} weight="fill"/> : null}{stats.status === 'paused' ? '继续计时' : stats.status === 'off' ? '今天好好休息' : stats.status === 'finished' ? '今天辛苦了' : stats.status === 'before' ? '到点自动开始计时' : '暂停计时'}</button><button className="reset-button" onClick={() => setModal('reset')} aria-label="重置今日计时" title="重置今日计时"><ArrowCounterClockwise size={16}/>重置</button></div>
      <dl className="summary"><div><dt>本月累计<span className="estimate-label">估算</span></dt><dd>¥{money(month)}</dd></div><div><dt>时薪</dt><dd>¥{money(stats.hourlyRate)}</dd></div><div><dt>今日满勤可得</dt><dd>¥{money(stats.dayTotal)}</dd></div></dl>
      <p className="card-footnote">已过工作日按当前排班估算，本月只计已赚，不含亏损。</p>
    </article>
    <p className="page-note">{storageProblem ? '浏览器未允许保存，关闭页面后设置可能丢失。' : '每一秒的努力，都值得被看见。'}<span>数据仅保存在当前浏览器</span></p>
    {modal === 'settings' && <Settings settings={settings} onSave={saveSettings} onPreviewTheme={setPreviewLook} onClose={() => {setPreviewLook(null);setModal(null);}}/>}
    {modal === 'reset' && <Modal title="重新开始今日计时？" onClose={() => setModal(null)} className="confirm-modal"><div className="modal-content"><p className="confirm-copy">清零今天累计的工时与收入，从现在重新计时。以往日期的记录会保留。</p></div><div className="confirm-actions"><button className="secondary-button" onClick={() => setModal(null)}>取消</button><button className="primary-button" onClick={resetToday}>确认重置</button></div></Modal>}
    {toast && <div role="status" className="toast"><Check size={16}/>{toast}</div>}
  </main>;
}
