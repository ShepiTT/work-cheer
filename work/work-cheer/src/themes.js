/**
 * Look = 主题 (a layout and material) × 颜色 (accent) × 外观 (light, dark or auto).
 * Tokens live in themes.css; structure per 主题 lives in styles.css (玻璃, 小组件, 纸墨) and
 * styles-more.css (the 1.10 themes: 像素, 赛博朋克, 千禧, 黏土, 液晶).
 * The optional-theme idea comes from WizzenH/xindong (MIT): https://github.com/WizzenH/xindong
 */
export const STYLES = [
  { id: 'glass', name: '玻璃', description: '通透磨砂，轻盈有层次' },
  { id: 'widgets', name: '小组件', description: '方块排布，一眼看全' },
  { id: 'zhimo', name: '纸墨', description: '纸面留白，安静克制' },
  { id: 'pixel', name: '像素', description: '八位机画风，上班像闯关' },
  { id: 'cyber', name: '赛博朋克', description: '霓虹切角，夜里会发光' },
  { id: 'y2k', name: '千禧', description: '灰色老窗口，梦回机房' },
  { id: 'clay', name: '黏土', description: '圆润软糯，像捏出来的' },
  { id: 'lcd', name: '液晶', description: '数码管跳字，像计价器' },
];
export const COLORS = [
  { id: 'blue', name: '蓝' }, { id: 'purple', name: '紫' }, { id: 'pink', name: '粉' }, { id: 'red', name: '红' },
  { id: 'orange', name: '橙' }, { id: 'yellow', name: '黄' }, { id: 'green', name: '绿' }, { id: 'graphite', name: '石墨' },
];
export const APPEARANCES = [{ id: 'light', name: '浅色' }, { id: 'dark', name: '深色' }, { id: 'auto', name: '自动' }];
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
