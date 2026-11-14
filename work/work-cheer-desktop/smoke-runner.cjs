const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const executable=path.resolve(__dirname,'dist/上班鼓励器-1.12.0-Windows-x64.exe');
const profile=fs.mkdtempSync(path.join(__dirname,'portable-profile-'));
fs.writeFileSync(path.join(profile,'desktop-preferences.json'),JSON.stringify({opacity:100,alwaysOnTop:false,closeToTray:false,floating:true,floatingBounds:{x:40,y:60,width:320,height:156}}));
const executableHash=()=>crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
async function run(phase) {
  const report=path.resolve(__dirname,'smoke-portable-'+phase+'.json');
  const temp=fs.mkdtempSync(path.join(__dirname,'portable-temp-'+phase+'-'));
  const args=['--smoke-test','--smoke-phase='+phase,'--smoke-output='+report,'--smoke-user-data='+profile];
  if(phase==='write')args.push('--floating');
  await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd:__dirname,windowsHide:true,stdio:'pipe',env:{...process.env,TEMP:temp,TMP:temp}});
    const timer=setTimeout(()=>{child.kill();reject(new Error('Portable '+phase+' timed out after 90 seconds'))},90000);
    child.stdout.on('data',chunk=>process.stdout.write(chunk));
    child.stderr.on('data',chunk=>process.stderr.write(chunk));
    child.on('error',error=>{clearTimeout(timer);reject(error)});
    child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Portable '+phase+' exited '+code))});
  });
  const result=JSON.parse(fs.readFileSync(report,'utf8'));
  if(!result.ok) throw new Error(JSON.stringify(result));
  return result;
}
(async()=>{
 const sha256=executableHash();
 const write=await run('write');
 const read=await run('read');
 if(executableHash()!==sha256)throw new Error('Executable changed while being tested');
 const summary={ok:write.ok&&read.ok,executable,sha256,version:write.appVersion,legacy13PreferencesMigrated:write.initialPreferences.floatingStyle==='capsule',writeEntryPath:write.entryPath,readEntryPath:read.entryPath,differentExtractionDirectories:write.entryPath!==read.entryPath,sameProfile:write.userData===read.userData,writeChecks:write.checks,readChecks:read.checks};
 if(!summary.differentExtractionDirectories||!summary.sameProfile)throw new Error('Portable extraction/profile independence failed');
 fs.writeFileSync(path.join(__dirname,'smoke-portable-summary.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify(summary,null,2));
})().catch(error=>{console.error(error);process.exit(1)});
