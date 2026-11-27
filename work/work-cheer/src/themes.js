/**
 * Look = 主题 (a layout and material) × 颜色 (accent) × 外观 (light, dark or auto).
 * Tokens live in themes.css; structure per 主题 lives in styles.css (玻璃, 小组件, 纸墨) and
 * styles-more.css (the 1.10 themes: 像素, 赛博朋克, 千禧, 黏土, 液晶).
 * The optional-theme idea comes from WizzenH/xindong (MIT): https://github.com/WizzenH/xindong
 */

const STYLE_I18N = {
  glass: { zh: { name: '玻璃', description: '通透磨砂，轻盈有层次' }, en: { name: 'Glass', description: 'Frosted layers, light and airy' } },
  widgets: { zh: { name: '小组件', description: '方块排布，一眼看全' }, en: { name: 'Widgets', description: 'Grid layout, see it all' } },
  zhimo: { zh: { name: '纸墨', description: '纸面留白，安静克制' }, en: { name: 'Paper & Ink', description: 'Whitespace and calm' } },
  pixel: { zh: { name: '像素', description: '八位机画风，上班像闯关' }, en: { name: 'Pixel', description: '8-bit style, work like a game' } },
  cyber: { zh: { name: '赛博朋克', description: '霓虹切角，夜里会发光' }, en: { name: 'Cyberpunk', description: 'Neon glow at night' } },
  y2k: { zh: { name: '千禧', description: '灰色老窗口，梦回机房' }, en: { name: 'Y2K', description: 'Gray windows, retro vibes' } },
  clay: { zh: { name: '黏土', description: '圆润软糯，像捏出来的' }, en: { name: 'Clay', description: 'Soft and squishy' } },
  lcd: { zh: { name: '液晶', description: '数码管跳字，像计价器' }, en: { name: 'LCD', description: 'Segment digits, like a meter' } },
};

const COLOR_I18N = {
  blue: { zh: '蓝', en: 'Blue' },
  purple: { zh: '紫', en: 'Purple' },
  pink: { zh: '粉', en: 'Pink' },
  red: { zh: '红', en: 'Red' },
  orange: { zh: '橙', en: 'Orange' },
  yellow: { zh: '黄', en: 'Yellow' },
  green: { zh: '绿', en: 'Green' },
  graphite: { zh: '石墨', en: 'Graphite' },
};

const APPEARANCE_I18N = {
  light: { zh: '浅色', en: 'Light' },
  dark: { zh: '深色', en: 'Dark' },
  auto: { zh: '自动', en: 'Auto' },
};

export function getStyles(lang = 'zh') {
  return Object.keys(STYLE_I18N).map(id => ({
    id,
    name: STYLE_I18N[id][lang]?.name || STYLE_I18N[id].zh.name,
    description: STYLE_I18N[id][lang]?.description || STYLE_I18N[id].zh.description,
  }));
}

export function getColors(lang = 'zh') {
  return Object.keys(COLOR_I18N).map(id => ({
    id,
    name: COLOR_I18N[id][lang] || COLOR_I18N[id].zh,
  }));
}

export function getAppearances(lang = 'zh') {
  return Object.keys(APPEARANCE_I18N).map(id => ({
    id,
    name: APPEARANCE_I18N[id][lang] || APPEARANCE_I18N[id].zh,
  }));
}

export const STYLES = Object.keys(STYLE_I18N).map(id => ({ id, name: STYLE_I18N[id].zh.name, description: STYLE_I18N[id].zh.description }));
export const COLORS = Object.keys(COLOR_I18N).map(id => ({ id, name: COLOR_I18N[id].zh }));
export const APPEARANCES = Object.keys(APPEARANCE_I18N).map(id => ({ id, name: APPEARANCE_I18N[id].zh }));
export const DEFAULT_LOOK = Object.freeze({ theme: 'glass', themeColor: 'blue', appearance: 'auto' });

// Palettes picked in 1.x or 1.5 become 纸墨 in the nearest colour. "original"/"paper" were the
// untouched defaults, so they move to the new default look like an empty setting does.
const LEGACY = {
  night: ['green', 'dark'], maillard: ['orange', 'dark'], morandi: ['purple', 'light'], rose: ['pink', 'light'], ember: ['red', 'dark'],
  forest: ['green', 'light'], matcha: ['green', 'light'], klein: ['blue', 'dark'],
  ink: ['red', 'dark'], celadon: ['green', 'light'], pine: ['green', 'dark'], begonia: ['pink', 'light'], lilac: ['purple', 'light'],
  indigo: ['blue', 'dark'], amber: ['orange', 'dark'], auto: ['red', 'auto'],
};
const has = (list, id) => list.some(item => item.id === id);

/** The saved look, upgraded from any older theme value. */
export function normalizeLook(settings = {}) {
  const { theme, themeColor, appearance } = settings || {};
  if (has(STYLES, theme)) return { theme, themeColor: has(COLORS, themeColor) ? themeColor : DEFAULT_LOOK.themeColor, appearance: has(APPEARANCES, appearance) ? appearance : DEFAULT_LOOK.appearance };
  if (LEGACY[theme]) return { theme: 'zhimo', themeColor: LEGACY[theme][0], appearance: LEGACY[theme][1] };
  return { ...DEFAULT_LOOK };
}

export function prefersDarkScheme() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
}

export function resolveScheme(appearance, prefersDark = prefersDarkScheme()) {
  return appearance === 'auto' ? (prefersDark ? 'dark' : 'light') : appearance;
}

/** Paint a look onto <html>; previews use the same three attributes on their own element. */
export function applyLook(settings, prefersDark) {
  const look = normalizeLook(settings), root = document.documentElement;
  root.dataset.style = look.theme;
  root.dataset.color = look.themeColor;
  root.dataset.scheme = resolveScheme(look.appearance, prefersDark);
}
