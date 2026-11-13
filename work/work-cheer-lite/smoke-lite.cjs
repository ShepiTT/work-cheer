// Runs the lite EXE's built-in checks twice against throwaway profiles (never the real %APPDATA%),
// after seeding a full-edition profile to test the first-run data migration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = __dirname;
const exe = path.join(root, 'dist', '上班鼓励器-轻量版-1.10.0.exe');
const electron = path.resolve(root, '../work-cheer-desktop/node_modules/electron/dist/electron.exe');
const work = fs.mkdtempSync(path.join(root, 'smoke-'));
const source = path.join(work, 'full-edition');
const profile = path.join(work, 'lite-profile');
const shots = path.join(root, 'qa');

const seed = spawnSync(electron, [path.join(root, 'tools', 'seed-full-profile.cjs'), '--profile=' + source], { stdio: 'inherit', timeout: 120000 });
if (seed.status !== 0) throw new Error('seeding the full-edition profile failed');
const hash = () => crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
const sha256 = hash();
function phase(name) {
  const output = path.join(work, name + '.json');
  spawnSync(exe, ['--smoke', '--phase=' + name, '--profile=' + profile, '--output=' + output, '--source-profile=' + source, '--expect-goal=迁移测试', '--shots=' + shots], { stdio: 'inherit', timeout: 120000 });
  return fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : { ok: false, errors: ['no report written'] };
}
const write = phase('write');
const read = phase('read');
const summary = { ok: Boolean(write.ok && read.ok && sha256 === hash()), executable: exe, bytes: fs.statSync(exe).size, sha256, write, read };
fs.writeFileSync(path.join(root, 'smoke-lite-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
