// The isolated preload handles pointer capture without exposing IPC or Node to the page.
const {ipcRenderer}=require('electron');
let pointer=null,lastPoint=null,captureTarget=null;
const point=event=>({x:event.screenX,y:event.screenY});
function finish(){
  if(pointer===null)return;
  const id=pointer;pointer=null;
  ipcRenderer.send('work-cheer-floating-drag','end',lastPoint);
  if(captureTarget?.hasPointerCapture(id))captureTarget.releasePointerCapture(id);
  captureTarget=null;
}
document.addEventListener('pointerdown',event=>{
  if(!event.isTrusted||event.button!==0||!event.target.closest('.floating-widget'))return;
  pointer=event.pointerId;lastPoint=point(event);captureTarget=event.target;
  captureTarget.setPointerCapture(pointer);event.preventDefault();
  ipcRenderer.send('work-cheer-floating-drag','start',lastPoint);
},true);
document.addEventListener('pointermove',event=>{
  if(!event.isTrusted||pointer!==event.pointerId)return;
  if(!(event.buttons&1)){finish();return;}
  lastPoint=point(event);ipcRenderer.send('work-cheer-floating-drag','move',lastPoint);
},true);
document.addEventListener('pointerup',event=>{if(event.isTrusted&&pointer===event.pointerId){lastPoint=point(event);finish();}},true);
document.addEventListener('pointercancel',finish,true);
document.addEventListener('lostpointercapture',finish,true);
window.addEventListener('blur',finish);
