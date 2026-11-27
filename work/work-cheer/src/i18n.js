/**
 * Internationalization (i18n) support for Work Cheer.
 * Default language is Chinese for existing users; persisted in settings.
 */

export const LANGUAGES = [
  { id: 'zh', name: '简体中文', nativeName: '简体中文' },
  { id: 'en', name: 'English', nativeName: 'English' },
];

export const DEFAULT_LANGUAGE = 'zh';

const translations = {
  zh: {
    appTitle: '上班鼓励器',
    seal: '励',
    settings: '设置',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    weekdaysFull: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    
    // Date format
    dateFormat: (month, day) => `${month}月${day}日`,
    weekdayPrefix: '周',
    
    // Status labels
    statusBefore: '待上班',
    statusWorking: '上班中',
    statusBreak: '午休中',
    statusFinished: '已下班',
    statusOff: '休息日',
    statusHoliday: '放假中',
    statusMakeup: '调休补班',
    statusPaused: '已暂停',
    
    // Income section
    todayEarned: '今日已赚',
    perSecond: '每秒',
    rateBeforeWork: '到上班时间后自动开始累计',
    rateOnBreak: '午休中，收入暂停累计',
    ratePaused: '已暂停，收入暂停累计',
    rateFinished: '今天的工时已经走完',
    rateOffDay: '今天是休息日',
    monthlySalaryBasis: (salary, days) => `月薪 ¥${salary} · 本月 ${days} 个工作日`,
    
    // Countdown section
    countdownToWork: '距离上班还有',
    countdownToLunch: '距离中午下班还有',
    countdownToAfternoon: '午休中 · 距下午上班',
    countdownToEnd: '距离下班还有',
    countdownToEndSplit: '距离今日下班还有',
    offDayMessage: '今天不用赶时间',
    offDayRest: '享受你的休息日',
    finishedMessage: '今天的工作已结束',
    finishedText: '下班啦，生活继续',
    hours: '小时',
    minutes: '分',
    seconds: '秒',
    
    // Progress
    progressLabel: '今日工时进度',
    workedHours: (worked, total) => `已工作 ${worked} / ${total} 小时`,
    
    // Goal section
    goalLabel: '今日小目标',
    miniGoal: '小目标',
    editGoal: '编辑目标',
    
    // Encouragements (returns [prefix, strong, suffix] for rendering)
    encourageRestDay: (name) => ['今天的任务：', '好好休息', '，快乐也很重要。'],
    encourageGoalReached: (name) => ['今天的努力，已经赚到', '「' + name + '」', '了。'],
    encouragePaused: () => ['稀作停留。', '照顾自己', '，也是今天的重要任务。'],
    encourageFinished: (earned) => ['今天已攒下 ', '¥' + earned, '，辛苦啦。'],
    encourageWorking: (time, name) => ['再工作 ', time, '，' + name + '就赚回来了。'],
    timeFormat: (hours, minutes) => hours >= 1 ? (hours + '小时' + (minutes ? minutes + '分钟' : '')) : (minutes + '分钟'),
    
    // Timer controls
    continueTimer: '继续计时',
    restToday: '今天好好休息',
    hardWorkToday: '今天辛苦了',
    autoStartTimer: '到点自动开始计时',
    pauseTimer: '暂停计时',
    resetLabel: '重置',
    resetTitle: '重置今日计时',
    
    // Summary
    monthlyTotal: '本月累计',
    estimate: '估算',
    hourlyRate: '时薪',
    dailyFull: '今日满勤可得',
    
    // Footnotes
    cardFootnote: '已过工作日按当前排班估算，本月只计已赚，不含亏损。',
    storageWarning: '浏览器未允许保存，关闭页面后设置可能丢失。',
    pageNote: '每一秒的努力，都值得被看见。',
    localStorageNote: '数据仅保存在当前浏览器',
    
    // Toasts
    toastContinued: '已继续计时，每一秒都算数。',
    toastPaused: '已暂停，休息一下也很好。',
    toastSaved: '设置已保存，按新设置重新计算。',
    toastReset: '今日计时已重置。',
    
    // Reset modal
    resetModalTitle: '重新开始今日计时？',
    resetModalContent: '清零今天累计的工时与收入，从现在重新计时。以往日期的记录会保留。',
    cancel: '取消',
    confirmReset: '确认重置',
    
    // Settings
    settingsTitle: '设置你的工作日',
    tabSalary: '工资与作息',
    tabCalendar: '工作日历',
    tabAppearance: '外观',
    
    // Salary tab
    salaryIntro: '按日薪直接计时，或让月薪随排班自动折算。',
    dailySalary: '按日薪',
    monthlySalary: '按月薪',
    dailySalaryLabel: '每日工资',
    monthlySalaryLabel: '每月工资',
    yuanPerDay: '元 / 天',
    yuanPerMonth: '元 / 月',
    dailySalaryNote: '每日工资按设置的有效工时均匀累计，仅作鼓励参考。',
    monthlySalaryNote: '日薪 = 月薪 ÷ 当月实际标记的工作日数。可在「工作日历」调整放假与调休。',
    startTime: '上班时间',
    endTime: '下班时间',
    middayCountdown: '午间分段倒计时',
    middayCountdownDesc: '上午等中午下班，午休等下午上班，下午等今日下班',
    deductLunch: '扣除午休',
    deductLunchDesc: '午休期间暂停累计工时与收入',
    middayOff: '中午下班',
    afternoonStart: '下午上班',
    lunchStart: '午休开始',
    lunchEnd: '午休结束',
    middayCountdownNote: '分段倒计时不改变工资算法；是否扣除午休工时，由上面的"扣除午休"决定。',
    goalSection: '给努力一个小目标',
    goalName: '想奖励自己',
    goalAmount: '目标金额（元）',
    salaryFootnote: '按工作进度估算，非工资结算。月薪总额保持不变，放假与调休会改变分摊的工作日数。仅支持当天班次；修改排班会重新估算，暂停和重置记录保留。',
    
    // Calendar tab
    autoHolidays: '自动安排放假与调休',
    autoHolidaysDesc: '中国大陆官方安排，个别日期可手动修改',
    holidayEnabled: (year) => `${year} 年国务院放假、调休安排已启用`,
    holidayUnavailable: (year) => `${year} 年官方安排尚未内置，暂按每周规律计算，可手动调整`,
    holidayDisabled: '已关闭官方安排，按每周规律和手动调整计算',
    weeklyPattern: '每周规律',
    doubleWeekend: '双休',
    singleWeekend: '单休',
    weekdaysLabel: '每周工作日',
    monthFormat: (year, month) => `${year}年${month}月`,
    prevMonth: '上个月',
    nextMonth: '下个月',
    calendarLabel: (monthLabel) => `${monthLabel}排班日历`,
    workdaysCount: (count) => `本月工作 ${count} 天`,
    dailyRateCalc: (rate) => `日薪 ¥${rate}`,
    monthlyRateCalc: (rate) => `折合日薪 ¥${rate}`,
    clearMonthAdjust: '清除本月手动调整',
    calendarHelp: '假 = 放假，补 = 调休补班；圆点表示手动调整。点击日期切换班休，手动修改优先于官方安排。清除调整会恢复官方安排及每周规律。',
    work: '班',
    rest: '休',
    makeup: '补',
    holiday: '假',
    manualAdjust: '手动调整',
    officialArrange: '官方安排',
    
    // Appearance tab
    appearanceIntro: '主题决定排版和质感，颜色、外观可以随意搭配。点一下就能预览。',
    themeLabel: '主题',
    colorLabel: '颜色',
    appearanceLabel: '外观',
    appearanceNote: '"自动"跟随系统的浅色或深色模式。保存后记住选择，取消或关闭设置会恢复原来的样子。',
    languageLabel: '语言',
    languageNote: '界面语言立即生效。假期日历保持中国大陆安排。',
    
    // Theme names
    themeGlass: '玻璃',
    themeGlassDesc: '通透磨砂，轻盈有层次',
    themeWidgets: '小组件',
    themeWidgetsDesc: '方块排布，一眼看全',
    themeZhimo: '纸墨',
    themeZhimoDesc: '纸面留白，安静克制',
    themePixel: '像素',
    themePixelDesc: '八位机画风，上班像闯关',
    themeCyber: '赛博朋克',
    themeCyberDesc: '霓虹切角，夜里会发光',
    themeY2k: '千禧',
    themeY2kDesc: '灰色老窗口，梦回机房',
    themeClay: '黏土',
    themeClayDesc: '圆润软糯，像捏出来的',
    themeLcd: '液晶',
    themeLcdDesc: '数码管跳字，像计价器',
    
    // Color names
    colorBlue: '蓝',
    colorPurple: '紫',
    colorPink: '粉',
    colorRed: '红',
    colorOrange: '橙',
    colorYellow: '黄',
    colorGreen: '绿',
    colorGraphite: '石墨',
    
    // Appearance modes
    modeLight: '浅色',
    modeDark: '深色',
    modeAuto: '自动',
    
    saveSettings: '保存设置',
    
    // Window bar (Windows desktop)
    floatingWidget: '进入悬浮窗',
    more: '更多',
    minimize: '最小化',
    maximize: '最大化',
    restore: '还原',
    close: '关闭',
    
    // Floating widget
    floatTodayEarned: '今日已赚',
    floatCountdown: '距下班',
    floatRestDay: '休息日',
    floatFinished: '已下班',
    floatTodayPlan: '今日安排',
    floatTodayWork: '今日工作',
  },
  
  en: {
    appTitle: 'Work Cheer',
    seal: '励',
    settings: 'Settings',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    weekdaysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    
    // Date format
    dateFormat: (month, day) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${day}`,
    weekdayPrefix: '',
    
    // Status labels
    statusBefore: 'Before Work',
    statusWorking: 'Working',
    statusBreak: 'Lunch Break',
    statusFinished: 'Done',
    statusOff: 'Day Off',
    statusHoliday: 'Holiday',
    statusMakeup: 'Makeup Day',
    statusPaused: 'Paused',
    
    // Income section
    todayEarned: "Today's Earnings",
    perSecond: '/sec',
    rateBeforeWork: 'Starts automatically at work time',
    rateOnBreak: 'On break, earnings paused',
    ratePaused: 'Paused, earnings paused',
    rateFinished: "Today's work hours completed",
    rateOffDay: 'Today is a rest day',
    monthlySalaryBasis: (salary, days) => `Monthly ¥${salary} · ${days} workdays`,
    
    // Countdown section
    countdownToWork: 'Until work starts',
    countdownToLunch: 'Until midday off',
    countdownToAfternoon: 'Break · Until afternoon',
    countdownToEnd: 'Until clock out',
    countdownToEndSplit: 'Until end of day',
    offDayMessage: 'No rush today',
    offDayRest: 'Enjoy your day off',
    finishedMessage: "Today's work is done",
    finishedText: 'Off work, life goes on',
    hours: 'h',
    minutes: 'm',
    seconds: 's',
    
    // Progress
    progressLabel: "Today's work progress",
    workedHours: (worked, total) => `Worked ${worked} / ${total} hours`,
    
    // Goal section
    goalLabel: "Today's mini goal",
    miniGoal: 'Goal',
    editGoal: 'Edit goal',
    
    // Encouragements (returns [prefix, strong, suffix] for rendering)
    encourageRestDay: (name) => ["Today's task: ", 'Rest well', '. Joy matters too.'],
    encourageGoalReached: (name) => ["Today's effort earned you ", '"' + name + '"', '!'],
    encouragePaused: () => ['Take a moment. ', 'Self-care', ' is also an important task.'],
    encourageFinished: (earned) => ["Today you've earned ", '¥' + earned, '. Well done!'],
    encourageWorking: (time, name) => ['Work ', time, ' more to earn "' + name + '".'],
    timeFormat: (hours, minutes) => hours >= 1 ? (hours + 'h' + (minutes ? ' ' + minutes + 'min' : '')) : (minutes + ' min'),
    
    // Timer controls
    continueTimer: 'Resume',
    restToday: 'Rest well today',
    hardWorkToday: 'Well done today',
    autoStartTimer: 'Auto-starts at work time',
    pauseTimer: 'Pause',
    resetLabel: 'Reset',
    resetTitle: 'Reset today',
    
    // Summary
    monthlyTotal: 'Monthly Total',
    estimate: 'Est.',
    hourlyRate: 'Hourly',
    dailyFull: 'Full Day',
    
    // Footnotes
    cardFootnote: 'Past workdays estimated by schedule. Monthly total counts earnings only.',
    storageWarning: 'Storage not allowed. Settings may be lost when page closes.',
    pageNote: 'Every second of effort deserves to be seen.',
    localStorageNote: 'Data saved locally in this browser',
    
    // Toasts
    toastContinued: 'Resumed. Every second counts.',
    toastPaused: 'Paused. Taking a break is good too.',
    toastSaved: 'Settings saved. Recalculating...',
    toastReset: "Today's timer has been reset.",
    
    // Reset modal
    resetModalTitle: 'Reset today?',
    resetModalContent: "Clear today's accumulated time and earnings, restart from now. Past records are kept.",
    cancel: 'Cancel',
    confirmReset: 'Reset',
    
    // Settings
    settingsTitle: 'Settings',
    tabSalary: 'Salary & Schedule',
    tabCalendar: 'Work Calendar',
    tabAppearance: 'Appearance',
    
    // Salary tab
    salaryIntro: 'Calculate by daily salary, or let monthly salary adjust with your schedule.',
    dailySalary: 'Daily',
    monthlySalary: 'Monthly',
    dailySalaryLabel: 'Daily Salary',
    monthlySalaryLabel: 'Monthly Salary',
    yuanPerDay: '¥ / day',
    yuanPerMonth: '¥ / month',
    dailySalaryNote: 'Daily salary accumulates evenly during work hours. For reference only.',
    monthlySalaryNote: 'Daily rate = Monthly ÷ actual workdays. Adjust holidays in "Work Calendar".',
    startTime: 'Start Time',
    endTime: 'End Time',
    middayCountdown: 'Midday Countdown',
    middayCountdownDesc: 'Count to midday off, then to afternoon start, then to end of day',
    deductLunch: 'Deduct Lunch',
    deductLunchDesc: 'Pause earnings during lunch break',
    middayOff: 'Midday Off',
    afternoonStart: 'Afternoon Start',
    lunchStart: 'Lunch Start',
    lunchEnd: 'Lunch End',
    middayCountdownNote: 'Midday countdown does not change salary calculation; "Deduct Lunch" controls that separately.',
    goalSection: 'Set a mini goal',
    goalName: 'Reward yourself with',
    goalAmount: 'Target amount (¥)',
    salaryFootnote: 'Progress-based estimate, not actual payroll. Monthly total stays the same; holidays change the workday distribution. Same-day shifts only; schedule changes recalculate; pause and reset records are kept.',
    
    // Calendar tab
    autoHolidays: 'Auto Holidays & Makeup Days',
    autoHolidaysDesc: 'China mainland official schedule; individual dates can be adjusted',
    holidayEnabled: (year) => `${year} official holidays enabled`,
    holidayUnavailable: (year) => `${year} official schedule not built-in; using weekly pattern`,
    holidayDisabled: 'Official schedule disabled; using weekly pattern and manual adjustments',
    weeklyPattern: 'Weekly Pattern',
    doubleWeekend: 'Sat-Sun Off',
    singleWeekend: 'Sun Off',
    weekdaysLabel: 'Workdays',
    monthFormat: (year, month) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}`,
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    calendarLabel: (monthLabel) => `${monthLabel} work calendar`,
    workdaysCount: (count) => `${count} workdays this month`,
    dailyRateCalc: (rate) => `Daily ¥${rate}`,
    monthlyRateCalc: (rate) => `Equiv. daily ¥${rate}`,
    clearMonthAdjust: 'Clear month adjustments',
    calendarHelp: 'Off = holiday, Work = makeup day; dot = manual adjustment. Tap date to toggle. Manual overrides official schedule. Clearing restores official and weekly patterns.',
    work: 'Work',
    rest: 'Off',
    makeup: 'Work',
    holiday: 'Off',
    manualAdjust: 'Manual',
    officialArrange: 'Official',
    
    // Appearance tab
    appearanceIntro: 'Theme sets layout and feel; color and mode can mix freely. Tap to preview.',
    themeLabel: 'Theme',
    colorLabel: 'Color',
    appearanceLabel: 'Mode',
    appearanceNote: '"Auto" follows system light/dark mode. Saved after confirm; cancel reverts.',
    languageLabel: 'Language',
    languageNote: 'UI language applies immediately. Holiday calendar stays China mainland.',
    
    // Theme names
    themeGlass: 'Glass',
    themeGlassDesc: 'Frosted layers, light and airy',
    themeWidgets: 'Widgets',
    themeWidgetsDesc: 'Grid layout, see it all',
    themeZhimo: 'Paper & Ink',
    themeZhimoDesc: 'Whitespace and calm',
    themePixel: 'Pixel',
    themePixelDesc: '8-bit style, work like a game',
    themeCyber: 'Cyberpunk',
    themeCyberDesc: 'Neon glow at night',
    themeY2k: 'Y2K',
    themeY2kDesc: 'Gray windows, retro vibes',
    themeClay: 'Clay',
    themeClayDesc: 'Soft and squishy',
    themeLcd: 'LCD',
    themeLcdDesc: 'Segment digits, like a meter',
    
    // Color names
    colorBlue: 'Blue',
    colorPurple: 'Purple',
    colorPink: 'Pink',
    colorRed: 'Red',
    colorOrange: 'Orange',
    colorYellow: 'Yellow',
    colorGreen: 'Green',
    colorGraphite: 'Graphite',
    
    // Appearance modes
    modeLight: 'Light',
    modeDark: 'Dark',
    modeAuto: 'Auto',
    
    saveSettings: 'Save',
    
    // Window bar (Windows desktop)
    floatingWidget: 'Floating Widget',
    more: 'More',
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
    close: 'Close',
    
    // Floating widget
    floatTodayEarned: 'Earned',
    floatCountdown: 'Clock Out',
    floatRestDay: 'Day Off',
    floatFinished: 'Done',
    floatTodayPlan: 'Today',
    floatTodayWork: "Today's Work",
  },
};

export function getTranslation(lang) {
  return translations[lang] || translations[DEFAULT_LANGUAGE];
}

export function t(lang, key, ...args) {
  const trans = getTranslation(lang);
  const value = trans[key];
  if (typeof value === 'function') {
    return value(...args);
  }
  return value ?? key;
}

export function isValidLanguage(lang) {
  return LANGUAGES.some(l => l.id === lang);
}

export function normalizeLanguage(lang) {
  return isValidLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}
