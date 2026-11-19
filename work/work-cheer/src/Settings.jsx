import React, { useState } from 'react';
import { Check, CaretLeft, CaretRight, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Modal } from './Modal.jsx';
import { DEFAULT_SETTINGS, validateSettings, dateKey, getCalendarDay } from './calculator.js';
import { getStyles, getColors, getAppearances, normalizeLook, resolveScheme } from './themes.js';
import { HOLIDAY_YEARS } from './holidays.js';
import { LANGUAGES, DEFAULT_LANGUAGE, getTranslation, normalizeLanguage } from './i18n.js';

/** A miniature of one 主题, painted with its real tokens in the chosen colour and appearance. */
function StylePreview({ style, color, scheme }) {
  return <span className="style-preview" data-style={style} data-color={color} data-scheme={scheme} aria-hidden="true">
    <span className="mini-card"><span className="mini-top"><i className="mini-seal"/><b><em>¥</em>86</b></span><span className="mini-cells"><i className="on"/><i className="on"/><i className="on"/><i/></span></span>
    <span className="mini-tile"><i className="mini-ring"/></span>
  </span>;
}

export function Settings({ settings, onSave, onClose, onPreviewTheme, lang: propLang }) {
  const lang = normalizeLanguage(propLang || settings.language);
  const T = getTranslation(lang);
  const STYLES = getStyles(lang);
  const COLORS = getColors(lang);
  const APPEARANCES = getAppearances(lang);
  const WEEKDAYS = T.weekdays;
  const TABS = [T.tabSalary, T.tabCalendar, T.tabAppearance];
  const calendarWeekdays = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['一', '二', '三', '四', '五', '六', '日'];
  
  const [draft, setDraft] = useState({ ...DEFAULT_SETTINGS, ...settings, ...normalizeLook(settings), calendarOverrides: {...settings.calendarOverrides}, language: lang });
  const [errors, setErrors] = useState([]);
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  
  const field = (key, value) => { setDraft(d => ({ ...d, [key]: value })); setErrors([]); };
  const days = Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1));
  const working = d => getCalendarDay(draft,d).work;
  const dayCount = days.filter(working).length;
  const monthLabel = T.monthFormat(month.getFullYear(), month.getMonth()+1);
  const today = dateKey(new Date());
  const scheme = resolveScheme(draft.appearance);
  
  function pickLook(change) {
    const look = { theme: draft.theme, themeColor: draft.themeColor, appearance: draft.appearance, ...change };
    setDraft(d => ({ ...d, ...look })); setErrors([]); onPreviewTheme(look);
  }
  
  function toggleDay(d) {
    const key = dateKey(d), next = {...draft.calendarOverrides}, value = !working(d);
    const base = getCalendarDay({...draft,calendarOverrides:{}},d).work;
    if (value === base) delete next[key]; else next[key] = value;
    field('calendarOverrides', next);
  }
  
  function resetMonth() {
    const prefix = dateKey(month).slice(0,7);
    field('calendarOverrides',Object.fromEntries(Object.entries(draft.calendarOverrides).filter(([key])=>!key.startsWith(prefix))));
  }
  
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const next = {...draft,
      startTime:form.get('startTime') || draft.startTime, endTime:form.get('endTime') || draft.endTime,
      breakStart:form.get('breakStart') || draft.breakStart, breakEnd:form.get('breakEnd') || draft.breakEnd,
      dailySalary:Number(draft.dailySalary), monthlySalary:Number(draft.monthlySalary),
      goalAmount:Number(draft.goalAmount), goalName:draft.goalName.trim(), language: draft.language};
    const issues=validateSettings(next);
    if (issues.length) {setErrors(issues); setTab(0); return;}
    onSave(next);
  }
  
  const getCalendarDayLabel = (info, work) => {
    if (info.source === 'weekly') return work ? T.work : T.rest;
    return work ? T.makeup : T.holiday;
  };
  
  return <Modal title={T.settingsTitle} onClose={onClose} className="settings-modal">
    <div className="settings-tabs" role="tablist" aria-label={T.settings}>
      {TABS.map((label,i)=><button type="button" role="tab" id={'settings-tab-'+i} aria-controls={'settings-panel-'+i} aria-selected={tab===i} tabIndex={tab===i?0:-1} key={i} onClick={()=>setTab(i)} onKeyDown={e=>{
        if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(next);document.getElementById('settings-tab-'+next)?.focus();}
      }}>{label}</button>)}
    </div>
    <form onSubmit={submit} noValidate>
      <div className="modal-content">
        <section role="tabpanel" id="settings-panel-0" aria-labelledby="settings-tab-0" hidden={tab!==0}>
          <p className="modal-intro">{T.salaryIntro}</p>
          <div className="salary-mode" aria-label={T.tabSalary}>
            <button type="button" aria-pressed={draft.salaryMode==='daily'} onClick={()=>field('salaryMode','daily')}>{T.dailySalary}</button>
            <button type="button" aria-pressed={draft.salaryMode==='monthly'} onClick={()=>field('salaryMode','monthly')}>{T.monthlySalary}</button>
          </div>
          <label className="field">{draft.salaryMode==='monthly'?T.monthlySalaryLabel:T.dailySalaryLabel}
            <span className="input-wrap"><span className="input-prefix">¥</span><input type="number" min="0.01" max="1000000" step="0.01" value={draft.salaryMode==='monthly'?draft.monthlySalary:draft.dailySalary} onChange={e=>field(draft.salaryMode==='monthly'?'monthlySalary':'dailySalary',e.target.value)}/><span className="input-suffix">{draft.salaryMode==='monthly'?T.yuanPerMonth:T.yuanPerDay}</span></span>
          </label>
          <p className="field-note">{draft.salaryMode==='monthly'?T.monthlySalaryNote:T.dailySalaryNote}</p>
          <div className="field-row">
            <label className="field">{T.startTime}<input type="time" name="startTime" value={draft.startTime} onInput={e=>field('startTime',e.currentTarget.value)} onChange={e=>field('startTime',e.target.value)}/></label>
            <label className="field">{T.endTime}<input type="time" name="endTime" value={draft.endTime} onInput={e=>field('endTime',e.currentTarget.value)} onChange={e=>field('endTime',e.target.value)}/></label>
          </div>
          <div className="break-switch"><div><span>{T.middayCountdown}</span><p>{T.middayCountdownDesc}</p></div><button type="button" role="switch" aria-checked={draft.splitCountdown} aria-label={T.middayCountdown} className={'switch '+(draft.splitCountdown?'checked':'')} onClick={()=>field('splitCountdown',!draft.splitCountdown)}><span/></button></div>
          <div className="break-switch"><div><span>{T.deductLunch}</span><p>{T.deductLunchDesc}</p></div><button type="button" role="switch" aria-checked={draft.breakEnabled} aria-label={T.deductLunch} className={'switch '+(draft.breakEnabled?'checked':'')} onClick={()=>field('breakEnabled',!draft.breakEnabled)}><span/></button></div>
          {(draft.breakEnabled||draft.splitCountdown)&&<div className="field-row break-times">
            <label className="field">{draft.splitCountdown?T.middayOff:T.lunchStart}<input type="time" name="breakStart" value={draft.breakStart} onInput={e=>field('breakStart',e.currentTarget.value)} onChange={e=>field('breakStart',e.target.value)}/></label>
            <label className="field">{draft.splitCountdown?T.afternoonStart:T.lunchEnd}<input type="time" name="breakEnd" value={draft.breakEnd} onInput={e=>field('breakEnd',e.currentTarget.value)} onChange={e=>field('breakEnd',e.target.value)}/></label>
          </div>}
          {draft.splitCountdown&&<p className="field-note">{T.middayCountdownNote}</p>}
          <div className="goal-section"><span className="section-label">{T.goalSection}</span><div className="field-row goal-fields">
            <label className="field">{T.goalName}<input maxLength={16} value={draft.goalName} onChange={e=>field('goalName',e.target.value)}/></label>
            <label className="field">{T.goalAmount}<input type="number" min="0.01" max="1000000" step="0.01" value={draft.goalAmount} onChange={e=>field('goalAmount',e.target.value)}/></label>
          </div></div>
          <p className="settings-footnote">{T.salaryFootnote}</p>
        </section>
        <section role="tabpanel" id="settings-panel-1" aria-labelledby="settings-tab-1" hidden={tab!==1}>
          <div className="break-switch holiday-switch"><div><span>{T.autoHolidays}</span><p>{T.autoHolidaysDesc}</p></div><button type="button" role="switch" aria-checked={draft.useChinaHolidays} aria-label={T.autoHolidays} className={'switch '+(draft.useChinaHolidays?'checked':'')} onClick={()=>field('useChinaHolidays',!draft.useChinaHolidays)}><span/></button></div>
          <p className={'holiday-source '+(draft.useChinaHolidays&&!HOLIDAY_YEARS.includes(month.getFullYear())?'unavailable':'')} role="status">{draft.useChinaHolidays ? HOLIDAY_YEARS.includes(month.getFullYear()) ? T.holidayEnabled(month.getFullYear()) : T.holidayUnavailable(month.getFullYear()) : T.holidayDisabled}</p>
          <div className="schedule-presets"><span>{T.weeklyPattern}</span><button type="button" onClick={()=>field('workdays',[1,2,3,4,5])}>{T.doubleWeekend}</button><button type="button" onClick={()=>field('workdays',[1,2,3,4,5,6])}>{T.singleWeekend}</button></div>
          <fieldset className="weekdays"><legend className="sr-only">{T.weekdaysLabel}</legend><div>{[1,2,3,4,5,6,0].map(day=><button type="button" key={day} aria-pressed={draft.workdays.includes(day)} aria-label={lang === 'en' ? WEEKDAYS[day] : '周'+WEEKDAYS[day]} className={draft.workdays.includes(day)?'selected':''} onClick={()=>field('workdays',draft.workdays.includes(day)?draft.workdays.filter(d=>d!==day):[...draft.workdays,day])}>{lang === 'en' ? WEEKDAYS[day].slice(0,2) : WEEKDAYS[day]}</button>)}</div></fieldset>
          <div className="calendar-header"><button type="button" className="icon-button" aria-label={T.prevMonth} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><CaretLeft size={18}/></button><strong>{monthLabel}</strong><button type="button" className="icon-button" aria-label={T.nextMonth} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><CaretRight size={18}/></button></div>
          <div className="calendar-week">{calendarWeekdays.map(d=><span key={d}>{d}</span>)}</div>
          <div className="calendar-grid" aria-label={T.calendarLabel(monthLabel)}>
            {Array.from({length:(month.getDay()+6)%7},(_,i)=><span key={'empty'+i}/>)}
            {days.map(d=>{const key=dateKey(d),info=getCalendarDay(draft,d),work=info.work,overridden=info.source==='manual';return <button type="button" key={key} aria-label={key+' '+info.label+(info.name?' '+info.name:'')+(overridden?' '+T.manualAdjust:info.source==='official'?' '+T.officialArrange:'')} aria-pressed={work} title={(info.name?info.name+' · ':'')+info.label+(overridden?'('+T.manualAdjust+')':'')} className={'calendar-day '+(work?'workday ':'restday ')+(info.source!=='weekly'?'adjusted-day ':'')+(key===today?'today':'')} onClick={()=>toggleDay(d)}><span>{d.getDate()}{overridden&&<sup>·</sup>}</span><small>{getCalendarDayLabel(info, work)}</small></button>;})}
          </div>
          <div className="calendar-summary"><span>{T.workdaysCount(dayCount)}</span><span>{draft.salaryMode==='monthly'?T.monthlyRateCalc((dayCount?(Number(draft.monthlySalary)||0)/dayCount:0).toFixed(2)):T.dailyRateCalc((Number(draft.dailySalary)||0).toFixed(2))}</span></div>
          <button type="button" className="calendar-reset" onClick={resetMonth}><ArrowCounterClockwise size={14}/>{T.clearMonthAdjust}</button>
          <p className="settings-footnote calendar-help">{T.calendarHelp}</p>
        </section>
        <section role="tabpanel" id="settings-panel-2" aria-labelledby="settings-tab-2" hidden={tab!==2}>
          <p className="modal-intro">{T.appearanceIntro}</p>
          <span className="section-label">{T.themeLabel}</span>
          <div className="style-grid">{STYLES.map(style=><button type="button" key={style.id} aria-label={T.themeLabel+' '+style.name} aria-pressed={draft.theme===style.id} className={'style-choice'+(draft.theme===style.id?' selected':'')} onClick={()=>pickLook({theme:style.id})}>
            <StylePreview style={style.id} color={draft.themeColor} scheme={scheme}/><span className="style-name">{style.name}{draft.theme===style.id&&<Check size={13} weight="bold"/>}</span><small>{style.description}</small>
          </button>)}</div>
          <span className="section-label look-label">{T.colorLabel}</span>
          <div className="color-dots" role="radiogroup" aria-label={T.colorLabel}>{COLORS.map(color=><button type="button" role="radio" key={color.id} aria-checked={draft.themeColor===color.id} aria-label={color.name} title={color.name} className="color-dot" data-style={draft.theme} data-color={color.id} data-scheme={scheme} onClick={()=>pickLook({themeColor:color.id})}/>)}</div>
          <span className="section-label look-label">{T.appearanceLabel}</span>
          <div className="appearance-mode" role="group" aria-label={T.appearanceLabel}>{APPEARANCES.map(mode=><button type="button" key={mode.id} aria-pressed={draft.appearance===mode.id} onClick={()=>pickLook({appearance:mode.id})}>{mode.name}</button>)}</div>
          <span className="section-label look-label">{T.languageLabel}</span>
          <div className="appearance-mode language-mode" role="group" aria-label={T.languageLabel}>{LANGUAGES.map(l=><button type="button" key={l.id} aria-pressed={draft.language===l.id} onClick={()=>field('language',l.id)}>{l.nativeName}</button>)}</div>
          <p className="field-note">{T.languageNote}</p>
          <p className="settings-footnote">{T.appearanceNote}</p>
        </section>
        {errors.length>0&&<div className="form-error" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
      </div>
      <div className="modal-footer settings-actions"><button type="button" className="secondary-button" onClick={onClose}>{T.cancel}</button><button type="submit" className="primary-button"><Check size={19} weight="bold"/>{T.saveSettings}</button></div>
    </form>
  </Modal>;
}
