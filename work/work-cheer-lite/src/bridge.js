// Injected by the lite (WebView2) edition before the page's own scripts. It offers the same
// window.workCheerWindow API as the full edition's window-preload.cjs and feeds the native floating widget.
(() => {
  const host = window.chrome && window.chrome.webview;
  if (!host) return;
  const post = message => host.postMessage(message);
  window.addEventListener('error', event => post({ type: 'error', message: String(event.message || event.error) }));

  const maximizedListeners = new Set();
  host.addEventListener('message', event => {
    const data = event.data;
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
    const probe = document.createElement('i');
    probe.hidden = true;
    document.body.append(probe);
    const colour = name => { probe.style.color = 'var(' + name + ')'; return getComputedStyle(probe).color; };
    let previous = '';
    const report = () => {
      const root = document.documentElement, status = document.querySelector('.status');
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
        style: root.dataset.style || 'glass', scheme: root.dataset.scheme || 'light',
        card: colour('--card'), text: colour('--text'), muted: colour('--muted'), accent: colour('--accent'),
        accent2: colour('--accent-2'), accentText: colour('--accent-text'), line: colour('--line'), edge: colour('--edge'),
      };
      const key = JSON.stringify(message);
      if (key !== previous) { previous = key; post(message); }
    };
    setInterval(report, 250);
    report();
    post({ type: 'ready' });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true }); else ready();
})();
