const fs=require('node:fs');
const path=require('node:path');
const assert=(value,message)=>{if(!value)throw new Error(message)};
module.exports=async function smokeFloating(api){
  const {app,session,Menu,screen,report,reportPath,phase,delay,getWindow,getPreferences,getFloating,getTrayMenu,getFloatingMenu,switchMode,secondInstance,savePreferences,persistPlacement,fitBounds,validBounds,destroyTray,floatingStyles,floatingThemes}=api;
  const js=source=>getWindow().webContents.executeJavaScript(source);
  const settle=()=>delay(350);
  const snapshot=()=>js(`(() => {const w=document.querySelector('.floating-widget');const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};return {style:document.body.dataset.floatingStyle,htmlStyle:document.documentElement.dataset.style,width:innerWidth,height:innerHeight,sourceAmount:document.querySelector('.income-value').textContent,amount:w?.querySelector('.float-money').textContent,time:w?.querySelector('.float-time').textContent,timeLabel:w?.querySelector('.float-time-group .float-label').textContent,sourceLabel:document.querySelector('.countdown')?.dataset.label,rects:w?[...w.querySelectorAll('.float-label,.float-money,.float-time')].map(rect):[],metricCount:w?.querySelectorAll('.float-metric').length,drag:w?getComputedStyle(w).webkitAppRegion:null,bodyBackground:getComputedStyle(document.body).backgroundColor,faceBackground:w?getComputedStyle(w.querySelector('.float-face')).backgroundColor:null,rootHidden:getComputedStyle(document.getElementById('root')).display==='none',ringProgress:w?.querySelector('canvas').dataset.progress,nodeExposed:typeof require!=='undefined',state:JSON.parse(localStorage.getItem('work-cheer-v1'))}})()`);
  function check(data,id){
    const design=floatingStyles[id];
    assert(data.style===id&&data.width===design.width&&data.height===design.height,'Incorrect style/viewport '+id+' '+JSON.stringify(data));
    assert(data.rootHidden&&data.metricCount===2,'Extra UI shown in '+id);
    assert(data.drag==='no-drag'&&data.bodyBackground==='rgba(0, 0, 0, 0)','Pointer drag/transparency incorrect in '+id);
    for(const r of data.rects)assert(r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=data.width+.5&&r.bottom<=data.height+.5,'Clipped text in '+id+' '+JSON.stringify(r));
    assert(data.amount==='¥'+Number(data.sourceAmount).toFixed(2),'Amount differs from calculator '+id);
    assert(/^(\d{2}:\d{2}:\d{2}|休息日|已下班)$/.test(data.time),'Incorrect countdown '+id+': '+data.time);
    if(id==='transparent')assert(data.faceBackground==='rgba(0, 0, 0, 0)','Transparent style has a panel');
    if(id==='ring')assert(Number.isFinite(Number(data.ringProgress)),'Ring progress absent');
    assert(!data.nodeExposed,'Node exposed');
  }
  const select=async(id,menu=getFloatingMenu())=>{menu.getMenuItemById('style-'+id).click();await switchMode(true,false,id);await settle();};
  const replaceState=async state=>{await js(`localStorage.setItem('work-cheer-v1',${JSON.stringify(JSON.stringify(state))})`);await switchMode(false,false);await switchMode(true,false);await settle();};
  await settle();
  const clock=async(hour,minute)=>{await js(`(() => {const D=window.__middayRealDate||(window.__middayRealDate=Date),at=new D(2026,10,4,${hour},${minute},0).getTime();window.Date=class extends D{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};})()`);await settle();};
  report.initialPreferences=getPreferences();report.initial=await snapshot();
  check(report.initial,getPreferences().floatingStyle);
  assert(getFloating()&&getWindow().isAlwaysOnTop()&&!getWindow().isResizable(),'Floating native window flags');
  assert(report.lastWindowReady.loadedBeforeShow,'Unprepared window was shown');
  report.checks.securePreparedFloatingWindow=true;
  const original=report.initial.state;
  report.styles={};report.screenshots={};
  if(phase==='write'){
    const paused={...original,settings:{...original.settings,startTime:'00:00',endTime:'23:59',breakEnabled:false,calendarOverrides:{'2026-11-04':true}},records:{'2026-11-04':{excludedMs:0,pausedAt:new Date(2026,10,4,9,15).getTime(),resetAt:null}}};
    await replaceState(paused);
    for(const id of Object.keys(floatingStyles)){
      await select(id);const data=await snapshot();check(data,id);
      assert(JSON.stringify(data.state)===JSON.stringify(paused),'Style switch changed salary/records');
      assert(getPreferences().floatingStyle===id,'Style preference not saved');
      const p=screen.getPrimaryDisplay().workArea;getWindow().setPosition(p.x+50+Object.keys(report.styles).length*40,p.y+80);persistPlacement();
      const start=getWindow().getBounds(),dragPoint=id==='ring'?{x:100,y:85}:id==='transparent'?{x:100,y:70}:{x:160,y:34};
      const starts=report.dragStarts||0,ends=report.dragEnds||0,wc=getWindow().webContents;
      wc.sendInputEvent({type:'mouseDown',...dragPoint,globalX:start.x+dragPoint.x,globalY:start.y+dragPoint.y,button:'left',clickCount:1});await delay(60);
      wc.sendInputEvent({type:'mouseMove',x:dragPoint.x+32,y:dragPoint.y+16,globalX:start.x+dragPoint.x+32,globalY:start.y+dragPoint.y+16,button:'left',modifiers:['leftButtonDown']});await delay(100);
      wc.sendInputEvent({type:'mouseUp',...dragPoint,globalX:start.x+dragPoint.x+32,globalY:start.y+dragPoint.y+16,button:'left',clickCount:1});await delay(250);
      const moved=getWindow().getBounds(),saved=getPreferences().floatingBoundsByStyle[id];
      assert((report.dragStarts||0)>starts&&(report.dragEnds||0)>ends,'Pointer drag did not complete in '+id);
      assert(Math.abs(moved.x-start.x-32)<=2&&Math.abs(moved.y-start.y-16)<=2,'Pointer drag did not move native window correctly '+id+' '+JSON.stringify({start,moved}));
      assert(saved.x===moved.x&&saved.y===moved.y,'Dragged position not saved '+id);
      const before=report.contextMenuEvents;const point=id==='ring'?{x:100,y:85}:id==='transparent'?{x:100,y:70}:{x:160,y:34};
      getWindow().webContents.sendInputEvent({type:'mouseDown',...point,button:'right',clickCount:1});getWindow().webContents.sendInputEvent({type:'mouseUp',...point,button:'right',clickCount:1});await delay(120);
      assert(report.contextMenuEvents>before,'Right click does not reach '+id);
      report.styles[id]={viewport:{width:data.width,height:data.height},amount:data.amount,time:data.time,rightClick:true,transparent:data.faceBackground==='rgba(0, 0, 0, 0)',programmaticDrag:{start,moved,saved}};
    }
    report.checks.allThreeStylesAndRealContextInput=true;report.checks.sameSalaryAndRecords=true;report.checks.preloadPointerDragMovesAndSavesAllStyles=true;
    // 1.12: every widget theme from the menu, in every style; the main window's look and the salary data stay as they were.
    const mainLook=report.initial.htmlStyle;report.widgetThemes={};
    for(const [theme] of floatingThemes){
      getFloatingMenu().getMenuItemById('theme-'+theme).click();await switchMode(true,false);
      for(const id of Object.keys(floatingStyles)){
        await select(id);const data=await snapshot();check(data,id);
        assert(data.htmlStyle===theme&&getPreferences().floatingTheme===theme,'Widget theme '+theme+' not applied in '+id+': '+data.htmlStyle);
        assert(JSON.stringify(data.state)===JSON.stringify(paused),'Widget theme changed salary/records/main look');
      }
      report.widgetThemes[theme]=Object.keys(floatingStyles);
    }
    await js(`document.documentElement.dataset.style=${JSON.stringify(mainLook==='lcd'?'glass':mainLook)}`);await delay(60);
    assert((await snapshot()).htmlStyle==='lcd','Widget theme not held when the page re-applies its look');
    getTrayMenu().getMenuItemById('theme-follow').click();await switchMode(true,false);await settle();
    const followed=await snapshot();check(followed,getPreferences().floatingStyle);
    assert(followed.htmlStyle===mainLook&&getPreferences().floatingTheme==='','Follow-main-window theme not restored: '+followed.htmlStyle);
    report.checks.widgetThemeIndependentOfMainWindow=true;
    const before=await snapshot();await delay(1250);const after=await snapshot();
    assert(before.amount===after.amount&&before.time!==after.time,'Pause must freeze money while countdown continues');report.checks.pauseAndLiveCountdown=true;
    // These isolated captures use the same illustrative values as the selected design images.
    for(const id of Object.keys(floatingStyles)){
      await select(id);
      getWindow().webContents.beginFrameSubscription(()=>{});
      await js(`(() => {const source=document.getElementById('root');const clone=source.cloneNode(true);source.replaceWith(clone);clone.querySelector('.income-value').textContent='86.5200';clone.querySelector('.countdown').innerHTML='<span>2</span><small>小时</small><span>18</span><small>分</small><span>36</span><small>秒</small>';clone.querySelector('[role="progressbar"]').setAttribute('aria-valuenow','79.7');source.classList.add('qa-detached');})()`);
      await delay(450);check(await snapshot(),id);
      const image=reportPath.replace(/\.json$/i,'-'+id+'.png');await getWindow().webContents.capturePage();await delay(200);fs.writeFileSync(image,(await getWindow().webContents.capturePage()).toPNG());report.screenshots[id]=image;
      getWindow().webContents.endFrameSubscription();
      await switchMode(false,false);
    }
    // Long earnings, 23-hour timer, rest and finish labels must fit every silhouette.
    for(const id of Object.keys(floatingStyles)){
      await select(id);
      await js(`(() => {const s=document.getElementById('root');const c=s.cloneNode(true);s.replaceWith(c);c.querySelector('.income-value').textContent='1000000.0000';c.querySelector('.countdown').innerHTML='<span>23</span><small>小时</small><span>59</span><small>分</small><span>59</span><small>秒</small>';s.classList.add('qa-detached');})()`);
      await delay(350);check(await snapshot(),id);
      await switchMode(false,false);
    }
    report.checks.largeAmountsAndLongCountdownFit=true;
    const rest={...original,settings:{...original.settings,calendarOverrides:{'2026-11-04':false}},records:{}};
    await replaceState(rest);for(const id of Object.keys(floatingStyles)){await select(id);const s=await snapshot();check(s,id);assert(s.time==='休息日','Rest day '+id);}
    const finished={...original,settings:{...original.settings,startTime:'00:00',endTime:'01:00',calendarOverrides:{'2026-11-04':true}},records:{}};
    await replaceState(finished);for(const id of Object.keys(floatingStyles)){await select(id);const s=await snapshot();check(s,id);assert(s.time==='已下班','Finished day '+id);}
    report.checks.restAndFinishedInAllStyles=true;
    const split={...original,settings:{...original.settings,splitCountdown:true,startTime:'08:30',endTime:'17:00',breakEnabled:true,breakStart:'12:00',breakEnd:'13:00',calendarOverrides:{'2026-11-04':true}},records:{}};
    await replaceState(split);
    for(const id of Object.keys(floatingStyles)){
      await select(id);
      for(const [h,m,label,time] of [[11,30,'距中午下班','00:30:00'],[12,30,'距下午上班','00:30:00'],[14,0,'距今日下班','03:00:00']]){
        await clock(h,m);const data=await snapshot();check(data,id);assert(data.timeLabel===label&&data.sourceLabel===label&&data.time===time,'Split countdown not mirrored '+id+' '+label+': '+JSON.stringify(data));
      }
    }
    for(const [theme] of floatingThemes){
      getFloatingMenu().getMenuItemById('theme-'+theme).click();await switchMode(true,false);
      for(const id of Object.keys(floatingStyles)){await select(id);await clock(12,30);const data=await snapshot();check(data,id);assert(data.timeLabel==='距下午上班','Theme lost midday label '+theme+' '+id);}
    }
    report.checks.middayPhasesInEveryStyleAndTheme=true;

    await replaceState(original);
    await select('capsule',getTrayMenu());assert(getPreferences().floatingStyle==='capsule','Tray style selection');
    await secondInstance(['app','--floating-style=transparent']);check(await snapshot(),'transparent');report.checks.trayAndSecondInstanceStyleSelection=true;
    getWindow().webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});getWindow().webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});await delay(150);await switchMode(false,false);
    assert(!getFloating(),'Escape did not return full');
    assert(await js(`Boolean(document.querySelector('.window-bar .window-close'))&&typeof window.workCheerWindow?.minimize==='function'&&typeof require==='undefined'`),'Drawn title bar missing or Node exposed');report.checks.framelessWindowWithDrawnTitleBar=true;
    const full=fitBounds(false,{x:120,y:100,width:620,height:700});getWindow().setContentBounds(full);persistPlacement();savePreferences({alwaysOnTop:false});
    await select('ring',Menu.getApplicationMenu());getFloatingMenu().getMenuItemById('float-settings').click();await delay(100);await switchMode(false,false);await delay(150);
    assert(await js(`Boolean(document.querySelector('dialog')?.open)`),'Settings not opened in full window');assert(!getWindow().isAlwaysOnTop(),'Normal top flag polluted');
    assert(getWindow().getContentBounds().height===700,'Full size not restored');report.checks.escapeSettingsAndFullWindowRestore=true;
    getFloatingMenu().getMenuItemById('theme-lcd').click();await switchMode(true,false,'ring');persistPlacement();
    const fitted=fitBounds(true,{x:90000,y:90000,width:200,height:200},'ring');assert(screen.getAllDisplays().some(({workArea:a})=>fitted.x>=a.x&&fitted.y>=a.y&&fitted.x+fitted.width<=a.x+a.width&&fitted.y+fitted.height<=a.y+a.height),'Offscreen window not recoverable');
    assert(validBounds({x:NaN,y:0,width:10,height:10})===null,'Invalid placement accepted');report.checks.offscreenRecovery=true;
    report.savedPreferences=getPreferences();
  }else{
    assert(report.initial.style==='ring','Selected ring style did not survive restart');
    assert(report.initial.htmlStyle==='lcd'&&getPreferences().floatingTheme==='lcd','Widget theme did not survive restart: '+report.initial.htmlStyle);report.checks.widgetThemePersistsAcrossRestart=true;
    assert(report.initial.state.version===1&&report.initial.state.settings.goalName==='一场电影','Existing data not preserved');
    for(const id of Object.keys(floatingStyles)){await select(id);check(await snapshot(),id);const saved=getPreferences().floatingBoundsByStyle[id],actual=getWindow().getBounds();assert(saved.x===actual.x&&saved.y===actual.y,'Per-style placement lost '+id);}
    await switchMode(false,false);assert(getWindow().getContentBounds().height===700,'Full window size lost on restart');
    await switchMode(true,false,'ring');report.checks.styleAndPositionsPersistAcrossRestart=true;report.checks.allStylesLoadFromPortablePackage=true;
  }
  await settle();report.final=await snapshot();check(report.final,getPreferences().floatingStyle);
  assert(report.remoteRequests.length===0&&report.errors.length===0,'Unexpected network/error');report.checks.offlineNoErrors=true;
  report.ok=true;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));session.defaultSession.flushStorageData();destroyTray();app.quit();
};
