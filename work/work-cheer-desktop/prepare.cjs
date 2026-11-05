const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

async function main() {
  const source = path.resolve(__dirname, '../../outputs/上班鼓励器.html');
  let html = fs.readFileSync(source, 'utf8');
  html = html.replace('数据仅保存在当前浏览器', '数据仅保存在本机当前账户');
  html = html.replace('浏览器未允许保存，关闭页面后设置可能丢失。', '本机保存失败，关闭软件后设置可能丢失。');
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => "'sha256-" + crypto.createHash('sha256').update(match[1]).digest('base64') + "'");
  if (!hashes.length) throw new Error('No embedded renderer script found');
  const csp = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';`;
  html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
  fs.writeFileSync(path.join(__dirname,'renderer.html'), html);
  fs.mkdirSync(path.join(__dirname,'assets'), {recursive:true});
  // The vermilion seal drawn by make-seal-svg.py; transparent corners, same mark as the in-app header.
  const png256 = await sharp(fs.readFileSync(path.join(__dirname,'assets/seal.svg')),{density:288}).resize(256,256).png().toBuffer();
  fs.writeFileSync(path.join(__dirname,'assets/icon.png'),png256);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1,2); header.writeUInt16LE(1,4); header[6]=0;header[7]=0;
  header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png256.length,14);header.writeUInt32LE(22,18);
  fs.writeFileSync(path.join(__dirname,'assets/icon.ico'),Buffer.concat([header,png256]));
  const notices = ['THIRD PARTY NOTICES / 第三方许可\n\nElectron and Chromium notices are also distributed in the executable package.'];
  for (const packagePath of ['node_modules/@phosphor-icons/core/LICENSE', '../work-cheer/node_modules/react/LICENSE', '../work-cheer/node_modules/react-dom/LICENSE', '../work-cheer/node_modules/@phosphor-icons/react/LICENSE']) {
    const absolute = path.resolve(__dirname,packagePath);
    if (fs.existsSync(absolute)) notices.push('\n\n=== '+packagePath+' ===\n'+fs.readFileSync(absolute,'utf8'));
  }
  const font = html.match(/<!--([\s\S]*?SIL OPEN FONT LICENSE[\s\S]*?)-->/);
  if (font) notices.push('\n\n=== Noto Sans SC ===\n'+font[1]);
  const referenceLicense = fs.readFileSync(path.resolve(__dirname,'../work-cheer/public/licenses/xindong-MIT.txt'),'utf8');
  notices.push('\n\n=== WizzenH/xindong (interaction and payroll feature reference) ===\nSource: https://github.com/WizzenH/xindong\nReference commit: bf71f1a0fa27a4505db51fd7254cbc09582b37f3\nDesktop tray, settings restoration, opacity, calendar and theme interaction inspiration. Electron-specific implementation maintained by Work Cheer.\n\n'+referenceLicense);
  fs.writeFileSync(path.join(__dirname,'THIRD_PARTY_NOTICES.txt'),notices.join('\n'));
  console.log(JSON.stringify({rendererBytes:Buffer.byteLength(html),scriptHashes:hashes,icon:'assets/seal.svg (Noto Sans SC glyph, OFL)'}));
}
main().catch(error=>{console.error(error);process.exit(1)});
