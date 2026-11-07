// Prepares the lite build inputs in obj/: the offline page (desktop wording) and a multi-size icon.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(path.resolve(__dirname, '../../work-cheer-desktop/node_modules/sharp'));

const root = path.resolve(__dirname, '..');
const obj = path.join(root, 'obj');
fs.mkdirSync(obj, { recursive: true });

let html = fs.readFileSync(path.resolve(root, '../../outputs/上班鼓励器.html'), 'utf8');
for (const [from, to] of [['数据仅保存在当前浏览器', '数据仅保存在本机当前账户'], ['浏览器未允许保存，关闭页面后设置可能丢失。', '本机保存失败，关闭软件后设置可能丢失。']]) {
  if (!html.includes(from)) throw new Error('page text not found: ' + from);
  html = html.replace(from, to);
}
fs.writeFileSync(path.join(obj, 'index.html'), html);

// Classic 32-bit entries for the small sizes the taskbar and tray use, PNG for 256.
async function writeIcon() {
  const svg = fs.readFileSync(path.resolve(root, '../work-cheer-desktop/assets/seal.svg'));
  const images = [];
  for (const size of [16, 20, 24, 32, 40, 48, 64, 256]) {
    const pipeline = sharp(svg).resize(size, size);
    if (size === 256) { images.push({ size, data: await pipeline.png().toBuffer() }); continue; }
    const { data } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0); header.writeInt32LE(size, 4); header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(size * size * 4, 20);
    const pixels = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4, to = ((size - 1 - y) * size + x) * 4;
      pixels[to] = data[from + 2]; pixels[to + 1] = data[from + 1]; pixels[to + 2] = data[from]; pixels[to + 3] = data[from + 3];
    }
    images.push({ size, data: Buffer.concat([header, pixels, Buffer.alloc(Math.ceil(size / 32) * 4 * size)]) });
  }
  const directory = Buffer.alloc(6 + 16 * images.length);
  directory.writeUInt16LE(1, 2); directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    directory[entry] = image.size >= 256 ? 0 : image.size; directory[entry + 1] = image.size >= 256 ? 0 : image.size;
    directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.data.length, entry + 8); directory.writeUInt32LE(offset, entry + 12);
    offset += image.data.length;
  });
  fs.writeFileSync(path.join(obj, 'icon.ico'), Buffer.concat([directory, ...images.map(image => image.data)]));
}

writeIcon().then(() => console.log(JSON.stringify({ page: Buffer.byteLength(html), icon: fs.statSync(path.join(obj, 'icon.ico')).size })))
  .catch(error => { console.error(error); process.exit(1); });
