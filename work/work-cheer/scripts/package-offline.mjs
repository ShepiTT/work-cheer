#!/usr/bin/env node
/** Package the already-built client as a single file://-compatible HTML file. */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.join(projectRoot, 'dist', 'client');
const outputRoot = path.resolve(projectRoot, '..', '..', 'outputs');
const packageRoot = path.join(outputRoot, '上班鼓励器');
const entryPath = path.join(clientRoot, 'index.html');
const fontLicensePath = path.join(projectRoot, 'public', 'fonts', 'OFL.txt');
const referenceLicensePath = path.join(projectRoot, 'public', 'licenses', 'xindong-MIT.txt');

if (!existsSync(entryPath)) {
  throw new Error('缺少 dist/client/index.html，请先完成 npm run build，再运行离线打包脚本。');
}

function attributes(tag) {
  const result = {};
  const pattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function assetPath(reference, sourceFile = entryPath) {
  if (!reference || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(reference)) {
    throw new Error(`离线包不允许外部资源：${reference}`);
  }
  const cleanReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  const resolved = cleanReference.startsWith('/')
    ? path.resolve(clientRoot, `.${cleanReference}`)
    : path.resolve(path.dirname(sourceFile), cleanReference);
  const relative = path.relative(clientRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`资源路径超出构建目录：${reference}`);
  }
  if (!existsSync(resolved)) throw new Error(`找不到构建资源：${resolved}`);
  return resolved;
}

const mimeTypes = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
};

function inlineCss(filePath) {
  let css = readFileSync(filePath, 'utf8');
  if (/@import\b/i.test(css)) throw new Error('CSS 仍包含 @import，无法保证单文件离线运行。');
  css = css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, (whole, double, single, plain) => {
    const reference = (double ?? single ?? plain).trim();
    if (/^(?:data:|#)/i.test(reference)) return whole;
    const resource = assetPath(reference, filePath);
    const mimeType = mimeTypes[path.extname(resource).toLowerCase()] ?? 'application/octet-stream';
    return `url("data:${mimeType};base64,${readFileSync(resource).toString('base64')}")`;
  });
  // Prevent an embedded string or comment from ending the HTML style element.
  return css.replace(/<\/style/gi, '<\\/style');
}

let scriptCount = 0;
let styleCount = 0;
const inlineScripts = [];
let html = readFileSync(entryPath, 'utf8');

html = html.replace(/<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>\s*<\/script\s*>/gi, (tag) => {
  const attrs = attributes(tag);
  const filePath = assetPath(attrs.src);
  let code = readFileSync(filePath, 'utf8');
  // A classic inline script works under file:// without module/CORS restrictions.
  // This parse rejects static imports, exports and import.meta; dynamic imports
  // need a separate guard because they are valid syntax in classic scripts.
  try {
    new Script(code, { filename: filePath });
  } catch (error) {
    throw new Error(`构建脚本不能转换为普通内联脚本：${error.message}`);
  }
  if (/\bimport\s*\(/.test(code)) {
    throw new Error('构建脚本含动态 import，请先将客户端构建为单一脚本。');
  }
  code = code.replace(/<\/script/gi, '<\\/script');
  scriptCount += 1;
  inlineScripts.push(`<script>\n${code}\n</script>`);
  return '';
});

html = html.replace(/<link\b[^>]*>/gi, (tag) => {
  const attrs = attributes(tag);
  const relations = (attrs.rel ?? '').toLowerCase().split(/\s+/);
  if (relations.includes('stylesheet')) {
    styleCount += 1;
    return `<style>\n${inlineCss(assetPath(attrs.href))}\n</style>`;
  }
  // The bundle was checked to contain no imports, so preload hints are redundant.
  if (relations.includes('modulepreload') || relations.includes('preload')) return '';
  if (attrs.href && !/^(?:data:|#)/i.test(attrs.href)) {
    throw new Error(`HTML 中仍有未内联的 link 资源：${attrs.href}`);
  }
  return tag;
});

if (scriptCount === 0) throw new Error('没有找到可内联的客户端脚本。');
if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<script\b[^>]*\btype\s*=\s*["']module["']/i.test(html)) {
  throw new Error('HTML 中仍含外部脚本或模块脚本。');
}
if (/<(?:img|source|video|audio|iframe)\b[^>]*\bsrc\s*=\s*["'](?!data:|#)/i.test(html)) {
  throw new Error('HTML 中仍含未内联的媒体资源。');
}
if (!/<\/body\s*>/i.test(html)) throw new Error('HTML 缺少 body 结束标签。');
// Module scripts in the original head were deferred. Execute their classic
// equivalents after the app root exists, keeping the original script order.
html = html.replace(/<\/body\s*>/i, () => `${inlineScripts.join('\n')}\n</body>`);

if (!existsSync(fontLicensePath)) throw new Error('缺少内嵌字体的 OFL.txt 授权文件。');
// Decorative hyphen separators are spaced to keep this a valid HTML comment.
const embeddedLicense = readFileSync(fontLicensePath, 'utf8').replace(/-{2,}/g, value => value.split('').join(' '));
html = html.replace(/<head\s*>/i, () => `<head>\n<!--\nEmbedded font: Noto Sans SC\n${embeddedLicense}\n-->`);
const referenceLicense = readFileSync(referenceLicensePath, 'utf8');
html = html.replace(/<head\s*>/i, () => `<head>\n<!--\nCalendar and theme reference: https://github.com/WizzenH/xindong\n${referenceLicense.replace(/-{2,}/g, value => value.split('').join(' '))}\n-->`);

mkdirSync(packageRoot, { recursive: true });
const destination = path.join(outputRoot, '上班鼓励器.html');
writeFileSync(destination, html, 'utf8');
writeFileSync(path.join(packageRoot, '上班鼓励器.html'), html, 'utf8');
copyFileSync(fontLicensePath, path.join(packageRoot, '字体授权.txt'));
copyFileSync(referenceLicensePath, path.join(packageRoot, '参考项目授权.txt'));
console.log(`离线打包完成：${destination}`);
console.log(`已内联 ${scriptCount} 个脚本、${styleCount} 个样式表；文件大小 ${Buffer.byteLength(html, 'utf8')} 字节。`);
