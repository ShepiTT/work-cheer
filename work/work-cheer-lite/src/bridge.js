// Injected by the lite (WebView2) edition before the page's own scripts. It offers the same
// window.workCheerWindow API as the full edition's window-preload.cjs and feeds the native floating widget.
(() => {
  const host = window.chrome && window.chrome.webview;
  if (!host) return;
  const post = message => host.postMessage(message);
  window.addEventListener('error', event => post({ type: 'error', message: String(event.message || event.error) }));

  // 1.12: the floating widget may wear its own 主题 ('' follows the page); colour and appearance stay the page's.
  // The native side sends it in answer to 'ready' and when the menu changes it (see LiteApp.PickTheme).
  const THEMES = ['glass', 'widgets', 'zhimo', 'pixel', 'cyber', 'y2k', 'clay', 'lcd'];
  let widgetTheme = '', themeChanged = null;
  const pickTheme = value => {
    widgetTheme = THEMES.indexOf(value) >= 0 ? value : '';
    return themeChanged ? themeChanged() : null;
  };
  // Returns the widget's data at once, so the native side can repaint before it shows the widget.
  Object.defineProperty(window, '__workCheerFloatTheme', { value: pickTheme });

  const maximizedListeners = new Set();
  host.addEventListener('message', event => {
    const data = event.data;
    if (data && data.type === 'floatTheme') { pickTheme(data.value); return; }
    if (!data || data.type !== 'maximized') return;
    document.documentElement.toggleAttribute('data-window-maximized', data.value === true);
    maximizedListeners.forEach(listener => listener(data.value === true));
  });
  const action = name => () => post({ type: 'window', action: name });
  window.workCheerWindow = Object.freeze({
    minimize: action('minimize'), toggleMaximize: action('toggle-maximize'), close: action('close'), floating: action('floating'), menu: action('menu'),
    onMaximizedChange(callback) {
      if (typeof callback !== 'function') return () => {};
      maximizedListeners.add(callback);
      return () => maximizedListeners.delete(callback);
    },
  });

  const ready = () => {
    // The window has no frame: thin edges hand the press to the system sizing loop.
    const style = document.createElement('style');
    style.textContent = '[data-resize-edge]{position:fixed;z-index:2147483647;-webkit-app-region:no-drag}[data-window-maximized] [data-resize-edge]{display:none}';
    document.head.append(style);
    const edges = {
      n: 'top:0;left:8px;right:8px;height:5px;cursor:ns-resize', s: 'bottom:0;left:8px;right:8px;height:5px;cursor:ns-resize',
      w: 'left:0;top:8px;bottom:8px;width:5px;cursor:ew-resize', e: 'right:0;top:8px;bottom:8px;width:5px;cursor:ew-resize',
      nw: 'left:0;top:0;width:8px;height:8px;cursor:nwse-resize', ne: 'right:0;top:0;width:8px;height:8px;cursor:nesw-resize',
      sw: 'left:0;bottom:0;width:8px;height:8px;cursor:nesw-resize', se: 'right:0;bottom:0;width:8px;height:8px;cursor:nwse-resize',
    };
    for (const [edge, css] of Object.entries(edges)) {
      const handle = document.createElement('div');
      handle.dataset.resizeEdge = edge;
      handle.style.cssText = css;
      handle.addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); post({ type: 'resize', edge }); } });
      document.body.append(handle);
    }

    // Same reading as the full edition's floating-renderer.cjs, plus the look's resolved colours.
    // Each colour is painted into one pixel and read back, so the native side only ever sees
    // rgba() in sRGB, whatever CSS colour space a token was mixed in.
    // Tokens are attribute-scoped ([data-style][data-color][data-scheme] on one element), so a probe that
    // carries the widget theme resolves that theme's colours while the page keeps its own look.
    const probe = document.createElement('i');
    probe.hidden = true;
    probe.style.display = 'none';
    document.body.append(probe);
    const swatch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const colour = name => {
      probe.style.color = 'var(' + name + ', transparent)';
      swatch.clearRect(0, 0, 1, 1); swatch.fillStyle = '#000'; swatch.fillStyle = getComputedStyle(probe).color; swatch.fillRect(0, 0, 1, 1);
      const d = swatch.getImageData(0, 0, 1, 1).data;
      return 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (d[3] / 255).toFixed(3) + ')';
    };
    // Extra tokens the 1.10 themes' floating widgets are drawn with (see FloatThemes.cs).
    const TOKENS = ['--ink', '--drop', '--fill', '--raised', '--field', '--b1', '--b2', '--b3', '--b4', '--title-a', '--title-b', '--title-text', '--hl',
      '--clay-hi', '--clay-lo', '--clay-drop', '--lcd', '--lcd-ink', '--lcd-dim', '--lcd-ghost', '--bezel', '--shell-hi', '--frame-a', '--frame-b', '--glow'];
    let previous = '', timer = 0;
    const measure = () => {
      const root = document.documentElement, status = document.querySelector('.status');
      if (widgetTheme) {
        probe.dataset.style = widgetTheme; probe.dataset.color = root.dataset.color || 'blue'; probe.dataset.scheme = root.dataset.scheme || 'light';
      } else {
        delete probe.dataset.style; delete probe.dataset.color; delete probe.dataset.scheme;
      }
      const raw = Number(document.querySelector('.income-value')?.textContent), value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      const off = status?.classList.contains('off'), finished = status?.classList.contains('finished');
      const parts = [...(document.querySelector('.countdown')?.querySelectorAll(':scope > span') || [])].map(node => node.textContent.padStart(2, '0'));
      const progress = Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'));
      const message = {
        type: 'float', earned: value.toFixed(2),
        time: off ? '休息日' : finished ? '已下班' : parts.length === 3 ? parts.join(':') : '00:00:00',
        label: off ? '今日安排' : finished ? '今日工作' : '距下班',
        live: Boolean(status?.classList.contains('working')),
        progress: Math.max(0, Math.min(1, Number.isFinite(progress) ? progress / 100 : 0)),
        style: widgetTheme || root.dataset.style || 'glass', scheme: root.dataset.scheme || 'light',
        card: colour('--card'), text: colour('--text'), muted: colour('--muted'), accent: colour('--accent'),
        accent2: colour('--accent-2'), accentText: colour('--accent-text'), line: colour('--line'), edge: colour('--edge'),
        tokens: Object.fromEntries(TOKENS.map(name => [name.slice(2), colour(name)])),
      };
      return message;
    };
    const report = () => {
      const message = measure(), key = JSON.stringify(message);
      if (key !== previous) { previous = key; post(message); }
      return message;
    };
    // Reporting starts once the widget theme is known, so the widget never shows the page's theme first.
    const start = () => { if (!timer) timer = setInterval(report, 250); return report(); };
    themeChanged = start;
    post({ type: 'ready' });
    setTimeout(start, 1500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
