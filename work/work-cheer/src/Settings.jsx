import React, { useState } from 'react';
import { Check, CaretLeft, CaretRight, ArrowCounterClockwise } from '@phosphor-icons/react';
import { Modal } from './Modal.jsx';
import { DEFAULT_SETTINGS, validateSettings, dateKey, getCalendarDay } from './calculator.js';
import { STYLES, COLORS, APPEARANCES, normalizeLook, resolveScheme } from './themes.js';
import { HOLIDAY_YEARS } from './holidays.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const TABS = ['工资与作息', '工作日历', '外观'];
/** A miniature of one 主题, painted with its real tokens in the chosen colour and appearance. */
function StylePreview({ style, color, scheme }) {
  return <span className="style-preview" data-style={style} data-color={color} data-scheme={scheme} aria-hidden="true">
    <span className="mini-card"><span className="mini-top"><i className="mini-seal"/><b><em>¥</em>86</b></span><span className="mini-cells"><i className="on"/><i className="on"/><i className="on"/><i/></span></span>
    <span className="mini-tile"><i className="mini-ring"/></span>
  </span>;
}
export function Settings({ settings, onSave, onClose, onPreviewTheme }) {
  const [draft, setDraft] = useState({ ...DEFAULT_SETTINGS, ...settings, ...normalizeLook(settings), calendarOverrides: {...settings.calendarOverrides} });
  const [errors, setErrors] = useState([]);
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const field = (key, value) => { setDraft(d => ({ ...d, [key]: value })); setErrors([]); };
  const days = Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1));
  const working = d => getCalendarDay(draft,d).work;
  const dayCount = days.filter(working).length;
  const monthLabel = month.getFullYear() + '年' + (month.getMonth()+1) + '月';
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
      goalAmount:Number(draft.goalAmount), goalName:draft.goalName.trim()};
    const issues=validateSettings(next);
    if (issues.length) {setErrors(issues); setTab(0); return;}
    onSave(next);
  }
  return <Modal title="设置你的工作日" onClose={onClose} className="settings-modal">
    <div className="settings-tabs" role="tablist" aria-label="设置分类">
      {TABS.map((label,i)=><button type="button" role="tab" id={'settings-tab-'+i} aria-controls={'settings-panel-'+i} aria-selected={tab===i} tabIndex={tab===i?0:-1} key={label} onClick={()=>setTab(i)} onKeyDown={e=>{
        if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(next);document.getElementById('settings-tab-'+next)?.focus();}
      }}>{label}</button>)}
    </div>
    <form onSubmit={submit} noValidate>
      <div className="modal-content">
        <section role="tabpanel" id="settings-panel-0" aria-labelledby="settings-tab-0" hidden={tab!==0}>
          <p className="modal-intro">按日薪直接计时，或让月薪随排班自动折算。</p>
          <div className="salary-mode" aria-label="工资计算方式">
            <button type="button" aria-pressed={draft.salaryMode==='daily'} onClick={()=>field('salaryMode','daily')}>按日薪</button>
            <button type="button" aria-pressed={draft.salaryMode==='monthly'} onClick={()=>field('salaryMode','monthly')}>按月薪</button>
          </div>
          <label className="field">{draft.salaryMode==='monthly'?'每月工资':'每日工资'}
            <span className="input-wrap"><span className="input-prefix">¥</span><input type="number" min="0.01" max="1000000" step="0.01" value={draft.salaryMode==='monthly'?draft.monthlySalary:draft.dailySalary} onChange={e=>field(draft.salaryMode==='monthly'?'monthlySalary':'dailySalary',e.target.value)}/><span className="input-suffix">{draft.salaryMode==='monthly'?'元 / 月':'元 / 天'}</span></span>
          </label>
          <p className="field-note">{draft.salaryMode==='monthly'?'日薪 = 月薪 ÷ 当月实际标记的工作日数。可在「工作日历」调整放假与调休。':'每日工资按设置的有效工时均匀累计，仅作鼓励参考。'}</p>
          <div className="field-row">
            <label className="field">上班时间<input type="time" name="startTime" value={draft.startTime} onInput={e=>field('startTime',e.currentTarget.value)} onChange={e=>field('startTime',e.target.value)}/></label>
            <label className="field">下班时间<input type="time" name="endTime" value={draft.endTime} onInput={e=>field('endTime',e.currentTarget.value)} onChange={e=>field('endTime',e.target.value)}/></label>
          </div>
          <div className="break-switch"><div><span>扣除午休</span><p>午休期间暂停累计工时与收入</p></div><button type="button" role="switch" aria-checked={draft.breakEnabled} aria-label="扣除午休" className={'switch '+(draft.breakEnabled?'checked':'')} onClick={()=>field('breakEnabled',!draft.breakEnabled)}><span/></button></div>
          {draft.breakEnabled&&<div className="field-row break-times">
            <label className="field">午休开始<input type="time" name="breakStart" value={draft.breakStart} onInput={e=>field('breakStart',e.currentTarget.value)} onChange={e=>field('breakStart',e.target.value)}/></label>
            <label className="field">午休结束<input type="time" name="breakEnd" value={draft.breakEnd} onInput={e=>field('breakEnd',e.currentTarget.value)} onChange={e=>field('breakEnd',e.target.value)}/></label>
          </div>}
          <div className="goal-section"><span className="section-label">给努力一个小目标</span><div className="field-row goal-fields">
            <label className="field">想奖励自己<input maxLength={16} value={draft.goalName} onChange={e=>field('goalName',e.target.value)}/></label>
            <label className="field">目标金额（元）<input type="number" min="0.01" max="1000000" step="0.01" value={draft.goalAmount} onChange={e=>field('goalAmount',e.target.value)}/></label>
          </div></div>
          <p className="settings-footnote">按工作进度估算，非工资结算。月薪总额保持不变，放假与调休会改变分摊的工作日数。仅支持当天班次；修改排班会重新估算，暂停和重置记录保留。</p>
        </section>
        <section role="tabpanel" id="settings-panel-1" aria-labelledby="settings-tab-1" hidden={tab!==1}>
          <div className="break-switch holiday-switch"><div><span>自动安排放假与调休</span><p>中国大陆官方安排，个别日期可手动修改</p></div><button type="button" role="switch" aria-checked={draft.useChinaHolidays} aria-label="自动安排放假与调休" className={'switch '+(draft.useChinaHolidays?'checked':'')} onClick={()=>field('useChinaHolidays',!draft.useChinaHolidays)}><span/></button></div>
          <p className={'holiday-source '+(draft.useChinaHolidays&&!HOLIDAY_YEARS.includes(month.getFullYear())?'unavailable':'')} role="status">{draft.useChinaHolidays ? HOLIDAY_YEARS.includes(month.getFullYear()) ? month.getFullYear()+' 年国务院放假、调休安排已启用' : month.getFullYear()+' 年官方安排尚未内置，暂按每周规律计算，可手动调整' : '已关闭官方安排，按每周规律和手动调整计算'}</p>
          <div className="schedule-presets"><span>每周规律</span><button type="button" onClick={()=>field('workdays',[1,2,3,4,5])}>双休</button><button type="button" onClick={()=>field('workdays',[1,2,3,4,5,6])}>单休</button></div>
          <fieldset className="weekdays"><legend className="sr-only">每周工作日</legend><div>{[1,2,3,4,5,6,0].map(day=><button type="button" key={day} aria-pressed={draft.workdays.includes(day)} aria-label={'周'+WEEKDAYS[day]} className={draft.workdays.includes(day)?'selected':''} onClick={()=>field('workdays',draft.workdays.includes(day)?draft.workdays.filter(d=>d!==day):[...draft.workdays,day])}>{WEEKDAYS[day]}</button>)}</div></fieldset>
          <div className="calendar-header"><button type="button" className="icon-button" aria-label="上个月" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><CaretLeft size={18}/></button><strong>{monthLabel}</strong><button type="button" className="icon-button" aria-label="下个月" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><CaretRight size={18}/></button></div>
          <div className="calendar-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
          <div className="calendar-grid" aria-label={monthLabel+'排班日历'}>
            {Array.from({length:(month.getDay()+6)%7},(_,i)=><span key={'empty'+i}/>)}
            {days.map(d=>{const key=dateKey(d),info=getCalendarDay(draft,d),work=info.work,overridden=info.source==='manual';return <button type="button" key={key} aria-label={key+' '+info.label+(info.name?' '+info.name:'')+(overridden?' 手动调整':info.source==='official'?' 官方安排':'')} aria-pressed={work} title={(info.name?info.name+' · ':'')+info.label+(overridden?'（手动调整）':'')} className={'calendar-day '+(work?'workday ':'restday ')+(info.source!=='weekly'?'adjusted-day ':'')+(key===today?'today':'')} onClick={()=>toggleDay(d)}><span>{d.getDate()}{overridden&&<sup>·</sup>}</span><small>{info.source==='weekly'?(work?'班':'休'):(work?'补':'假')}</small></button>;})}
          </div>
          <div className="calendar-summary"><span>本月工作 <strong>{dayCount}</strong> 天</span><span>{draft.salaryMode==='monthly'?'折合日薪 ¥'+(dayCount?(Number(draft.monthlySalary)||0)/dayCount:0).toFixed(2):'日薪 ¥'+(Number(draft.dailySalary)||0).toFixed(2)}</span></div>
          <button type="button" className="calendar-reset" onClick={resetMonth}><ArrowCounterClockwise size={14}/>清除本月手动调整</button>
          <p className="settings-footnote calendar-help">假 = 放假，补 = 调休补班；圆点表示手动调整。点击日期切换班休，手动修改优先于官方安排。清除调整会恢复官方安排及每周规律。</p>
        </section>
        <section role="tabpanel" id="settings-panel-2" aria-labelledby="settings-tab-2" hidden={tab!==2}>
          <p className="modal-intro">主题决定排版和质感，颜色、外观可以随意搭配。点一下就能预览。</p>
          <span className="section-label">主题</span>
          <div className="style-grid">{STYLES.map(style=><button type="button" key={style.id} aria-label={'主题 '+style.name} aria-pressed={draft.theme===style.id} className={'style-choice'+(draft.theme===style.id?' selected':'')} onClick={()=>pickLook({theme:style.id})}>
            <StylePreview style={style.id} color={draft.themeColor} scheme={scheme}/><span className="style-name">{style.name}{draft.theme===style.id&&<Check size={13} weight="bold"/>}</span><small>{style.description}</small>
          </button>)}</div>
          <span className="section-label look-label">颜色</span>
          <div className="color-dots" role="radiogroup" aria-label="颜色">{COLORS.map(color=><button type="button" role="radio" key={color.id} aria-checked={draft.themeColor===color.id} aria-label={color.name} title={color.name} className="color-dot" data-style={draft.theme} data-color={color.id} data-scheme={scheme} onClick={()=>pickLook({themeColor:color.id})}/>)}</div>
          <span className="section-label look-label">外观</span>
          <div className="appearance-mode" role="group" aria-label="外观">{APPEARANCES.map(mode=><button type="button" key={mode.id} aria-pressed={draft.appearance===mode.id} onClick={()=>pickLook({appearance:mode.id})}>{mode.name}</button>)}</div>
          <p className="settings-footnote">“自动”跟随系统的浅色或深色模式。保存后记住选择，取消或关闭设置会恢复原来的样子。</p>
        </section>
        {errors.length>0&&<div className="form-error" role="alert">{errors.map(error=><p key={error}>{error}</p>)}</div>}
      </div>
      <div className="modal-footer settings-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Check size={19} weight="bold"/>保存设置</button></div>
    </form>
  </Modal>;
}

