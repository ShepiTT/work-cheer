// The full window draws its own title bar; only these window actions reach the main process.
const {contextBridge,ipcRenderer}=require('electron');
const action=name=>()=>ipcRenderer.send('work-cheer-window',name);
contextBridge.exposeInMainWorld('workCheerWindow',{
  minimize:action('minimize'),toggleMaximize:action('toggle-maximize'),close:action('close'),floating:action('floating'),menu:action('menu'),
  onMaximizedChange(callback){
    if(typeof callback!=='function')return ()=>{};
    const listener=(_event,maximized)=>callback(maximized===true);
    ipcRenderer.on('work-cheer-window-maximized',listener);
    return ()=>ipcRenderer.removeListener('work-cheer-window-maximized',listener);
  },
});
