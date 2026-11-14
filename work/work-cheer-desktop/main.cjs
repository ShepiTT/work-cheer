const {app, BrowserWindow, Menu, session, dialog, screen, Tray, nativeImage, ipcMain} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const VERSION = '1.13.0';
const mountFloating = require('./floating-renderer.cjs');
const floatingStyles = {
  capsule:{label:'极简胶囊',width:360,height:64},
  transparent:{label:'透明悬字',width:280,height:180},
  ring:{label:'倒计时圆环',width:200,height:200}
};
const validStyle = value => Object.hasOwn(floatingStyles,value) ? value : 'capsule';
// 1.12: the floating widget may wear its own 主题 ('' follows the main window); colour and appearance always follow.
const floatingThemes = [['glass','玻璃'],['widgets','小组件'],['zhimo','纸墨'],['pixel','像素'],['cyber','赛博朋克'],['y2k','千禧'],['clay','黏土'],['lcd','液晶']];
const validTheme = value => floatingThemes.some(([id]) => id === value) ? value : '';
const smoke = process.argv.includes('--smoke-test');
const argument = (name, fallback) => process.argv.find(v => v.startsWith(name + '='))?.slice(name.length + 1) || fallback;
const reportPath = path.resolve(argument('--smoke-output', path.join(__dirname, 'smoke-report.json')));
const phase = argument('--smoke-phase', 'write');
app.setAppUserModelId('com.workcheer.app');
app.setName('上班鼓励器');
app.setPath('userData', smoke ? path.resolve(argument('--smoke-user-data', path.join(__dirname, 'smoke-user-data'))) : path.join(app.getPath('appData'), 'WorkCheer'));
if (smoke) app.disableHardwareAcceleration();
if (!smoke && !app.requestSingleInstanceLock()) app.exit(0);

const preferencePath = path.join(app.getPath('userData'), 'desktop-preferences.json');
const opacityChoices = [100, 90, 80, 65];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {appVersion:VERSION, electronVersion:process.versions.electron, phase, entryPath:__dirname, mainExecutable:process.execPath, userData:app.getPath('userData'), errors:[], remoteRequests:[], contextMenuEvents:0, checks:{}};
function validBounds(value) {
  if (!value || !['x','y','width','height'].every(k => Number.isFinite(value[k]))) return null;
  if (value.width <= 0 || value.height <= 0 || value.width > 20000 || value.height > 20000 || Math.abs(value.x) > 100000 || Math.abs(value.y) > 100000) return null;
  return Object.fromEntries(['x','y','width','height'].map(k => [k, Math.round(value[k])]));
}
function loadPreferences() {
  let value = {};
  try {value = JSON.parse(fs.readFileSync(preferencePath,'utf8')) || {};} catch {}
  return {opacity:opacityChoices.includes(value.opacity)?value.opacity:100, alwaysOnTop:value.alwaysOnTop===true, closeToTray:value.closeToTray===true,
    floating:value.floating===true, floatingStyle:validStyle(value.floatingStyle), floatingTheme:validTheme(value.floatingTheme),
    fullBounds:validBounds(value.fullBounds), floatingBounds:validBounds(value.floatingBounds),
    floatingBoundsByStyle:Object.fromEntries(Object.keys(floatingStyles).map(id=>[id,validBounds(value.floatingBoundsByStyle?.[id])])),
    fullMaximized:value.fullMaximized===true};
}
let preferences = loadPreferences();
let mainWindow, tray, trayMenu, floatingMenu, windowMenu;
let isQuitting = false, switchingWindow = false, currentFloating = false, currentStyle = preferences.floatingStyle, currentTheme = preferences.floatingTheme, switchQueue = Promise.resolve();
let floatingDrag=null;
function logError(error) {
  try {fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.appendFileSync(path.join(app.getPath('userData'),'startup-error.log'),new Date().toISOString()+' '+(error.stack||error)+'\n');} catch {}
}
function fail(error) {
  report.errors.push(String(error.stack||error));logError(error);
  if (smoke) {try {fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify({...report,ok:false},null,2));} catch {}}
  destroyTray();app.exit(1);
}
process.on('uncaughtException',fail);
process.on('unhandledRejection',fail);
function savePreferences(change) {
  const next = {...preferences,...change};
  fs.mkdirSync(path.dirname(preferencePath),{recursive:true});
  fs.writeFileSync(preferencePath+'.tmp',JSON.stringify(next,null,2));
  fs.renameSync(preferencePath+'.tmp',preferencePath);preferences=next;
}
function fitBounds(floating, saved, style=currentStyle) {
  const valid = validBounds(saved);
  const area = (valid ? screen.getDisplayMatching(valid) : screen.getPrimaryDisplay()).workArea;
  const design = floatingStyles[validStyle(style)];
  const width = floating ? Math.min(design.width,area.width) : Math.min(Math.max(valid?.width||620,380),area.width);
  const height = floating ? Math.min(design.height,area.height) : Math.min(Math.max(valid?.height||1000,640),area.height);
  const initialX = valid?.x ?? (floating ? area.x+area.width-width-24 : area.x+Math.round((area.width-width)/2));
  const initialY = valid?.y ?? (floating ? area.y+40 : area.y+Math.round((area.height-height)/2));
  return {x:Math.round(Math.max(area.x,Math.min(initialX,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(initialY,area.y+area.height-height))),width,height};
}
// A resizable frameless window keeps an invisible thick frame whose size rounds differently at 125%
// scaling, so the full window is saved and restored by its content area; otherwise it grows on every rebuild.
const frameInsets=new WeakMap();
function placementOf(win, floating) {
  if (floating) return win.getNormalBounds();
  if (!win.isMaximized() && !win.isMinimized()) return win.getContentBounds();
  const normal=win.getNormalBounds(), inset=frameInsets.get(win)||{width:0,height:0};
  return {...normal,width:normal.width-inset.width,height:normal.height-inset.height};
}
function persistPlacement(win=mainWindow, floating=currentFloating, style=currentStyle) {
  if (!win || win.isDestroyed()) return;
  const bounds=fitBounds(floating,placementOf(win,floating),style);
  if (floating) savePreferences({floatingBounds:bounds,floatingBoundsByStyle:{...preferences.floatingBoundsByStyle,[style]:bounds}});
  else savePreferences({fullBounds:bounds,fullMaximized:win.isMaximized()});
}
ipcMain.on('work-cheer-floating-drag',(event,phase,point)=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||win!==mainWindow||!currentFloating||win.isDestroyed()||event.senderFrame!==win.webContents.mainFrame)return;
  if(!['start','move','end'].includes(phase)||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>100000||Math.abs(point.y)>100000)return;
  if(phase==='start'){
    floatingDrag={win,point,bounds:win.getBounds(),moved:false};report.dragStarts=(report.dragStarts||0)+1;return;
  }
  if(!floatingDrag||floatingDrag.win!==win)return;
  const dx=point.x-floatingDrag.point.x,dy=point.y-floatingDrag.point.y;
  if(floatingDrag.moved||Math.abs(dx)+Math.abs(dy)>=3){floatingDrag.moved=true;const size=floatingStyles[currentStyle];win.setBounds({x:Math.round(floatingDrag.bounds.x+dx),y:Math.round(floatingDrag.bounds.y+dy),width:size.width,height:size.height});report.dragMoves=(report.dragMoves||0)+1;}
  if(phase==='end'){
    floatingDrag=null;const actual=win.getBounds(),fit=fitBounds(true,actual);if(actual.x!==fit.x||actual.y!==fit.y)win.setBounds(fit);persistPlacement(win,true);report.dragEnds=(report.dragEnds||0)+1;
  }
});
// The full window draws its own title bar (see window-preload.cjs); only these fixed actions are accepted.
ipcMain.on('work-cheer-window',(event,action)=>{
  const win=BrowserWindow.fromWebContents(event.sender);
  if(!win||win!==mainWindow||currentFloating||win.isDestroyed()||event.senderFrame!==win.webContents.mainFrame)return;
  if(action==='minimize')win.minimize();
  else if(action==='toggle-maximize')win.isMaximized()?win.unmaximize():win.maximize();
  else if(action==='close')win.close();
  else if(action==='floating')switchMode(true,!smoke).catch(fail);
  else if(action==='menu'&&!smoke)windowMenu.popup({window:win});
});
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if(!mainWindow.isMaximized()) {
    const before=currentFloating?mainWindow.getBounds():mainWindow.getContentBounds(),fit=fitBounds(currentFloating,before);
    if(['x','y','width','height'].some(key=>before[key]!==fit[key]))currentFloating?mainWindow.setBounds(fit):mainWindow.setContentBounds(fit);
  }
  mainWindow.show();mainWindow.focus();refreshMenus();
}
function hideToTray() {if(mainWindow&&!mainWindow.isDestroyed()){tray&&!tray.isDestroyed()?mainWindow.hide():mainWindow.minimize();refreshMenus();}}
function updatePreference(change) {
  try {savePreferences(change);mainWindow.setOpacity(preferences.opacity/100);mainWindow.setAlwaysOnTop(currentFloating||preferences.alwaysOnTop);refreshMenus();} catch(error) {if(smoke)throw error;logError(error);}
}
async function openSettings() {
  await switchMode(false,!smoke);
  await mainWindow.webContents.executeJavaScript(`document.querySelector('.settings-button')?.click()`);
}
// Like picking a style: saved, then the widget is shown (rebuilt when it was already showing another theme).
function pickTheme(id){savePreferences({floatingTheme:validTheme(id)});return switchMode(true,!smoke);}
function quitApp(){isQuitting=true;app.quit();}
function destroyTray(){if(tray&&!tray.isDestroyed())tray.destroy();}
function refreshMenus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const hasTray=Boolean(tray&&!tray.isDestroyed());
  const topItem=()=>({id:'always-top',label:currentFloating?'悬浮窗始终置顶':'始终置顶',type:'checkbox',checked:currentFloating||preferences.alwaysOnTop,enabled:!currentFloating,click:item=>updatePreference({alwaysOnTop:item.checked})});
  const modeItem=()=>({id:'floating-mode',label:currentFloating?'返回完整窗口':'进入悬浮窗',click:()=>switchMode(!currentFloating,!smoke)});
  const styleItem=()=>({id:'floating-styles',label:'悬浮窗样式',submenu:Object.entries(floatingStyles).map(([id,design])=>({id:'style-'+id,label:design.label,type:'radio',checked:preferences.floatingStyle===id,click:()=>switchMode(true,!smoke,id)}))});
  // The separator splits Electron's radio groups; every pick rebuilds the menus (pickTheme → createWindow), so one tick stays.
  const themeRadio=([id,label])=>({id:'theme-'+(id||'follow'),label,type:'radio',checked:preferences.floatingTheme===id,click:()=>pickTheme(id)});
  const themeItem=()=>({id:'floating-themes',label:'悬浮窗主题',submenu:[themeRadio(['','跟随主窗口']),{type:'separator'},...floatingThemes.map(themeRadio)]});
  const aboutItem={label:'关于上班鼓励器',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'关于上班鼓励器',message:'上班鼓励器 '+VERSION,
    detail:'实时收入估算 · 下班倒计时 · 悬浮窗 · 托盘与透明度\n\n按住窗口顶部或卡片外的空白处可移动窗口；悬浮窗按住即可拖动，右键或按 Esc 返回完整窗口。\n工资与作息数据仅保存在本机当前 Windows 账户，收入仅为估算。\n\n桌面交互参考 WizzenH/xindong（MIT）。\n保存位置：'+app.getPath('userData'),buttons:['知道了']})};
  const windowItems=()=>[modeItem(),styleItem(),themeItem(),{id:'settings',label:'设置',click:openSettings},topItem(),
    {label:'窗口透明度',submenu:opacityChoices.map(value=>({id:'opacity-'+value,label:value+'%',type:'radio',checked:preferences.opacity===value,click:()=>updatePreference({opacity:value})}))},
    {type:'separator'},{id:'hide-to-tray',label:'收起到托盘',enabled:hasTray,click:hideToTray},
    {id:'close-to-tray',label:'关闭窗口时收起到托盘',type:'checkbox',checked:preferences.closeToTray,enabled:hasTray,click:item=>updatePreference({closeToTray:item.checked})},
    {type:'separator'},{label:'放大',role:'zoomIn',enabled:!currentFloating},{label:'缩小',role:'zoomOut',enabled:!currentFloating},{label:'恢复原始大小',role:'resetZoom',enabled:!currentFloating},
    {type:'separator'},{label:'最小化',role:'minimize'},{id:'quit',label:'退出',click:quitApp}];
  // No menu bar is drawn (frameless window); the application menu keeps its shortcuts and the ⋯ button pops windowMenu.
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'窗口',submenu:windowItems()},{label:'帮助',submenu:[aboutItem]}]));
  const items=windowItems();
  windowMenu=Menu.buildFromTemplate([...items.slice(0,-1),aboutItem,items.at(-1)]);
  mainWindow.setMenu(currentFloating?null:Menu.getApplicationMenu());
  floatingMenu=Menu.buildFromTemplate([styleItem(),themeItem(),{type:'separator'},{id:'float-full',label:'返回完整窗口',accelerator:'Esc',click:()=>switchMode(false,!smoke)},
    {id:'float-settings',label:'设置',click:openSettings},{id:'float-hide',label:'收起到托盘',enabled:hasTray,click:hideToTray},{type:'separator'},{id:'float-quit',label:'退出',click:quitApp}]);
  if(hasTray){trayMenu=Menu.buildFromTemplate([{id:'tray-show',label:'显示窗口',click:showWindow},modeItem(),styleItem(),themeItem(),{id:'tray-hide',label:'收起到托盘',enabled:mainWindow.isVisible(),click:hideToTray},
    {id:'tray-settings',label:'设置',click:openSettings},topItem(),{type:'separator'},{id:'tray-quit',label:'退出',click:quitApp}]);tray.setContextMenu(trayMenu);}
}
async function createWindow(floating, shouldShow, style, theme='') {
  const savedFloating=preferences.floatingBoundsByStyle[style]||preferences.floatingBounds;
  const bounds=fitBounds(floating,floating?savedFloating:preferences.fullBounds,style);
  const win=new BrowserWindow({...bounds,title:'上班鼓励器',show:false,frame:false,useContentSize:!floating,transparent:floating,resizable:!floating,maximizable:!floating,
    minWidth:floating?bounds.width:Math.min(380,bounds.width),minHeight:floating?bounds.height:Math.min(640,bounds.height),
    backgroundColor:floating?'#00000000':'#EEF0F6',icon:path.join(__dirname,'assets','icon.png'),opacity:preferences.opacity/100,alwaysOnTop:floating||preferences.alwaysOnTop,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false,preload:path.join(__dirname,floating?'floating-preload.cjs':'window-preload.cjs')}});
  mainWindow=win;currentFloating=floating;currentStyle=style;currentTheme=theme;
  const wc=win.webContents;
  wc.setWindowOpenHandler(()=>({action:'deny'}));
  wc.on('will-navigate',event=>event.preventDefault());
  wc.on('console-message',details=>{if(smoke&&details.level==='error')report.errors.push(details.message);});
  wc.on('render-process-gone',(_event,details)=>fail(new Error('Renderer stopped: '+details.reason)));
  win.on('page-title-updated',event=>event.preventDefault());
  wc.on('context-menu',(_event,params)=>{if(win===mainWindow&&currentFloating){report.contextMenuEvents++;report.contextMenuPoint={x:params.x,y:params.y};if(!smoke)floatingMenu.popup({window:win});}});
  wc.on('before-input-event',(event,input)=>{if(currentFloating&&input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();switchMode(false,!smoke).catch(fail);}});
  let placementTimer;
  const queuePlacement=()=>{clearTimeout(placementTimer);placementTimer=setTimeout(()=>{if(win===mainWindow&&!switchingWindow&&!isQuitting){try{persistPlacement(win,floating);}catch(error){logError(error);}}},200);};
  for(const event of ['move','resize','maximize','unmaximize'])win.on(event,queuePlacement);
  if(!floating)for(const [event,maximized] of [['maximize',true],['unmaximize',false]])win.on(event,()=>wc.send('work-cheer-window-maximized',maximized));
  win.on('close',event=>{if(switchingWindow||win!==mainWindow)return;persistPlacement(win,floating);if(!isQuitting&&preferences.closeToTray&&tray&&!tray.isDestroyed()){event.preventDefault();hideToTray();}});
  win.on('closed',()=>{clearTimeout(placementTimer);if(floatingDrag?.win===win)floatingDrag=null;});
  win.on('show',refreshMenus);win.on('hide',refreshMenus);
  refreshMenus();
  if(floating)win.setBounds(bounds);
  else{win.setContentBounds(bounds);const outer=win.getBounds(),inner=win.getContentBounds();frameInsets.set(win,{width:outer.width-inner.width,height:outer.height-inner.height});}
  await win.loadFile(path.join(__dirname,'renderer.html'));
  if(smoke)await wc.executeJavaScript(`(() => {const RealDate=Date, anchor=new RealDate(2026,10,4,9,30).getTime(),start=performance.now();window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[anchor+performance.now()-start]));}static now(){return anchor+performance.now()-start;}};})()`);
  for(let attempt=0;attempt<100;attempt++){if(await wc.executeJavaScript(`Boolean(document.querySelector('.income-value'))`))break;await delay(25);}
  if(floating){
    await wc.insertCSS(fs.readFileSync(path.join(__dirname,'floating.css'),'utf8'));
    await wc.executeJavaScript('('+mountFloating.toString()+')('+JSON.stringify(style)+','+JSON.stringify(theme)+')');
  }
  await wc.executeJavaScript(`document.fonts.ready.then(()=>true)`);
  if(floating)wc.setZoomFactor(1);
  if(!floating&&preferences.fullMaximized)win.maximize();
  report.lastWindowReady={floating,style,theme,loadedBeforeShow:!win.isVisible(),bounds:win.getBounds()};
  if(shouldShow){win.show();win.focus();}
  return win;
}
function switchMode(floating,shouldShow=true,style) {
  switchQueue=switchQueue.then(async()=>{
    const selected=validStyle(style||preferences.floatingStyle),theme=preferences.floatingTheme;
    if(mainWindow&&!mainWindow.isDestroyed()&&currentFloating===floating&&(!floating||currentStyle===selected&&currentTheme===theme)){if(shouldShow)showWindow();return mainWindow;}
    switchingWindow=true;
    try {
      if(mainWindow&&!mainWindow.isDestroyed()){
        const previous=mainWindow;persistPlacement(previous,currentFloating);previous.hide();session.defaultSession.flushStorageData();mainWindow=null;previous.destroy();
      }
      savePreferences({floating,floatingStyle:selected});return await createWindow(floating,shouldShow,selected,theme);
    } finally {switchingWindow=false;}
  });
  return switchQueue;
}
function secondInstance(argv) {
  const style=argv.find(value=>value.startsWith('--floating-style='))?.split('=')[1];
  if(style)return switchMode(true,!smoke,validStyle(style));
  if(argv.includes('--floating'))return switchMode(true,!smoke);
  if(argv.includes('--full'))return switchMode(false,!smoke);
  return switchQueue.then(()=>{showWindow();return mainWindow;});
}
app.on('second-instance',(_event,argv)=>{secondInstance(argv).catch(fail);});
app.on('before-quit',()=>{isQuitting=true;try{persistPlacement();}catch(error){logError(error);}destroyTray();});
app.on('window-all-closed',()=>{if(!switchingWindow)app.quit();});
app.whenReady().then(async()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{const remote=/^https?:|^wss?:/i.test(details.url);if(remote)report.remoteRequests.push(details.url);callback({cancel:remote});});
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets','icon.png')).resize({width:32,height:32}));
  tray.setToolTip('上班鼓励器');tray.on('click',showWindow);tray.on('double-click',showWindow);
  const requestedStyle=argument('--floating-style',null);
  const initial=requestedStyle||process.argv.includes('--floating')?true:process.argv.includes('--full')?false:preferences.floating;
  await switchMode(initial,!smoke,requestedStyle||preferences.floatingStyle);
  if(smoke)await require('./smoke-floating.cjs')({app,session,Menu,screen,report,reportPath,phase,delay,getWindow:()=>mainWindow,getPreferences:()=>({...preferences}),getFloating:()=>currentFloating,
    getTrayMenu:()=>trayMenu,getFloatingMenu:()=>floatingMenu,switchMode,secondInstance,openSettings,savePreferences,persistPlacement,fitBounds,validBounds,destroyTray,quitApp,floatingStyles,floatingThemes});
}).catch(fail);
