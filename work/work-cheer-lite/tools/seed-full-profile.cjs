// Run with the full edition's Electron: writes a full-edition style localStorage with a recognisable
// goal into --profile, so the lite edition's first-run migration can be checked without real data.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const profile = path.resolve(process.argv.find(arg => arg.startsWith('--profile=')).slice('--profile='.length));
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const page = path.join(profile, 'seed.html');
  fs.writeFileSync(page, '<!doctype html><title>seed</title>');
  const win = new BrowserWindow({ show: false });
  await win.loadFile(page);
  await win.webContents.executeJavaScript(`localStorage.setItem('work-cheer-v1', JSON.stringify({ version: 1, settings: { goalName: '迁移测试', goalAmount: 66 }, records: {} }))`);
  await win.webContents.session.flushStorageData();
  win.destroy();
  app.quit();
});
