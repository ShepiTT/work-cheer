// Reads the live calculator DOM; never writes salary settings or records.
// Serialised with toString() and run inside the page, so it must stay self-contained.
module.exports = function mountFloating(style, theme) {
  // 1.12: a widget theme of its own. Tokens and floating.css key off <html data-style>, so it is set there and
  // held: the page re-applies the main look when the system appearance changes, and the observer puts it back
  // before the next frame. Colour and appearance stay the main window's.
  const html = document.documentElement;
  if (theme) {
    const hold = () => {if (html.dataset.style !== theme) html.dataset.style = theme;};
    hold();new MutationObserver(hold).observe(html, {attributes: true, attributeFilter: ['data-style']});
  }
  document.body.dataset.floatingStyle = style;
  const widget = document.createElement('aside');
  widget.className = 'floating-widget';
  widget.setAttribute('aria-label', '今日收入与下班倒计时');
  widget.innerHTML = `<div class="float-face"><canvas class="float-ring" aria-hidden="true"></canvas>
    <div class="float-metric float-money-group"><span class="float-label"><i class="float-live" aria-hidden="true"></i>今日已赚</span><span class="float-money"><span class="float-currency">¥</span><span class="float-integer">0</span><span class="float-decimal">.00</span></span></div>
    <div class="float-metric float-time-group"><span class="float-label">距下班</span><span class="float-time">00:00:00</span></div>
    <span class="float-progress" aria-hidden="true"><i></i></span></div>`;
  document.body.append(widget);
  const root = document.getElementById('root');root.setAttribute('aria-hidden', 'true');
  const amount = widget.querySelector('.float-money'), integer = widget.querySelector('.float-integer'), decimal = widget.querySelector('.float-decimal');
  const timer = widget.querySelector('.float-time'), timeLabel = widget.querySelector('.float-time-group .float-label'), canvas = widget.querySelector('canvas');
  let previousRing;

  // Colours come from the look's tokens; resolving them through a probe turns var()/color-mix() into a real colour.
  const probe = document.createElement('b');probe.hidden = true;widget.append(probe);
  const swatch = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
  function rgba(name) {
    probe.style.color = 'var(' + name + ', transparent)';
    swatch.clearRect(0, 0, 1, 1);swatch.fillStyle = '#000';swatch.fillStyle = getComputedStyle(probe).color;swatch.fillRect(0, 0, 1, 1);
    const d = swatch.getImageData(0, 0, 1, 1).data;return [d[0], d[1], d[2], d[3] / 255];
  }
  const css = (c, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${(c[3] * alpha).toFixed(3)})`;
  const mix = (a, b, t) => [0, 1, 2, 3].map(i => a[i] + (b[i] - a[i]) * t);
  const TOKENS = {accent: '--accent', accent2: '--accent-2', text: '--text', card: '--card', ink: '--ink', fill: '--fill', raised: '--raised', field: '--field',
    b1: '--b1', b2: '--b2', b3: '--b3', b4: '--b4', titleA: '--title-a', titleB: '--title-b', titleText: '--title-text', hl: '--hl',
    clayHi: '--clay-hi', clayLo: '--clay-lo', clayDrop: '--clay-drop', lcdInk: '--lcd-ink', lcdGhost: '--lcd-ghost'};
  const CUSTOM = ['pixel', 'cyber', 'y2k', 'clay', 'lcd'];

  // An Apple Watch–style activity ring: dim track, gradient arc from accent to accent-2, shadowed end cap.
  function paintRing(progress) {
    const css = getComputedStyle(widget), accent = css.getPropertyValue('--float-accent').trim(), accent2 = css.getPropertyValue('--float-accent-2').trim();
    const ratio = window.devicePixelRatio || 1, key = [progress, ratio, accent, accent2].join(':');
    if (key === previousRing) return;previousRing = key;
    const size = 180, mid = size / 2, width = 14, radius = mid - 6 - width / 2, start = -Math.PI / 2;
    canvas.width = Math.round(size * ratio);canvas.height = Math.round(size * ratio);
    const context = canvas.getContext('2d');context.scale(ratio, ratio);context.clearRect(0, 0, size, size);
    context.lineCap = 'round';context.lineWidth = width;
    context.globalAlpha = .26;context.strokeStyle = accent;
    context.beginPath();context.arc(mid, mid, radius, 0, Math.PI * 2);context.stroke();context.globalAlpha = 1;
    if (progress > 0) {
      const end = start + Math.PI * 2 * progress, gradient = context.createConicGradient(start, mid, mid);
      gradient.addColorStop(0, accent);gradient.addColorStop(Math.max(progress, .01), accent2);gradient.addColorStop(1, accent2);
      context.strokeStyle = gradient;context.beginPath();context.arc(mid, mid, radius, start, end);context.stroke();
      context.save();context.shadowColor = 'rgba(0,0,0,.35)';context.shadowBlur = 6;context.fillStyle = accent2;
      context.beginPath();context.arc(mid + Math.cos(end) * radius, mid + Math.sin(end) * radius, width / 2, 0, Math.PI * 2);context.fill();context.restore();
    }
    canvas.dataset.progress = String(progress);
  }

  // ── The five 1.10 themes draw their own indicator on the canvas; floating.css sizes and places it.
  // work-cheer-lite/src/FloatThemes.cs paints the same designs natively: change both together.
  const rad = degrees => degrees * Math.PI / 180;
  function cells(g, n, size, gap, from, lit, on, off) {
    const list = [];
    for (let i = 0; i < n; i++) list.push([i, 0]);
    for (let i = 1; i < n; i++) list.push([n - 1, i]);
    for (let i = n - 2; i >= 0; i--) list.push([i, n - 1]);
    for (let i = n - 2; i >= 1; i--) list.push([0, i]);
    const order = list.slice(from).concat(list.slice(0, from)), count = Math.floor(lit * order.length + 1e-6);
    order.forEach(([x, y], i) => {
      const px = x * (size + gap), py = y * (size + gap);
      g.fillStyle = i < count ? on : off;g.fillRect(px, py, size, size);
      if (i < count) {g.fillStyle = 'rgba(255,255,255,.35)';g.fillRect(px, py, size, Math.max(1, Math.round(size / 4)));}
    });
  }
  function segmentRing(g, cx, cy, r, width, n, gap, lit, colourOf, off, glow) {
    const count = Math.floor(lit * n + 1e-6);g.lineWidth = width;g.lineCap = 'butt';
    for (let i = 0; i < n; i++) {
      const a0 = rad(-90 + i * 360 / n + gap / 2), a1 = rad(-90 + (i + 1) * 360 / n - gap / 2);
      g.save();
      if (i < count && glow) {g.shadowColor = glow;g.shadowBlur = 6;}
      g.strokeStyle = i < count ? colourOf(i / Math.max(1, n - 1)) : off;
      g.beginPath();g.arc(cx, cy, r, a0, a1);g.stroke();g.restore();
    }
  }
  function bevel(g, x, y, w, h, outer, inner) {
    const line = (c, x0, y0, ww, hh) => {g.fillStyle = c;g.fillRect(x0, y0, ww, hh);};
    line(outer[1], x, y + h - 1, w, 1);line(outer[1], x + w - 1, y, 1, h);line(outer[0], x, y, w - 1, 1);line(outer[0], x, y, 1, h - 1);
    line(inner[1], x + 1, y + h - 2, w - 2, 1);line(inner[1], x + w - 2, y + 1, 1, h - 2);line(inner[0], x + 1, y + 1, w - 3, 1);line(inner[0], x + 1, y + 1, 1, h - 3);
  }
  function blocksField(g, x, y, w, h, lit, c) {
    g.fillStyle = css(c.field);g.fillRect(x, y, w, h);
    bevel(g, x, y, w, h, [css(c.b3), css(c.b1)], [css(c.b4), css(c.b2)]);
    const inner = w - 6, block = 8, gap = 2, count = Math.floor((inner * lit + gap) / (block + gap) + 1e-6);
    g.fillStyle = css(c.hl);
    for (let i = 0; i < count; i++) g.fillRect(x + 3 + i * (block + gap), y + 3, Math.min(block, inner - i * (block + gap)), h - 6);
  }
  function ellipseSector(g, cx, cy, rx, ry, from, to) {
    g.beginPath();g.moveTo(cx, cy);g.ellipse(cx, cy, rx, ry, 0, from, to);g.closePath();
  }
  const painters = {
    pixel(g, w, h, p, c) {
      const on = css(c.accent), off = css(mix(c.card, c.ink, .18));
      if (style === 'capsule') return cells(g, 4, 6, 2, 0, p, on, off);
      if (style === 'ring') return cells(g, 9, 14, 4, 4, p, on, off);
      const n = 10, gap = 5, box = (w - (n - 1) * gap) / n;
      for (let i = 0; i < n; i++) {
        const x = i * (box + gap), f = Math.max(0, Math.min(1, p * n - i));
        g.fillStyle = css(c.ink);g.fillRect(x + 2, 0, box - 4, 2);g.fillRect(x + 2, h - 2, box - 4, 2);g.fillRect(x, 2, 2, h - 4);g.fillRect(x + box - 2, 2, 2, h - 4);
        g.fillStyle = css(c.card);g.fillRect(x + 2, 2, box - 4, h - 4);
        if (f > 0) {g.fillStyle = on;g.fillRect(x + 2, 2, (box - 4) * f, h - 4);g.fillStyle = 'rgba(255,255,255,.4)';g.fillRect(x + 2, 2, (box - 4) * f, 3);}
      }
    },
    cyber(g, w, h, p, c, dark) {
      const glow = dark ? css(c.accent, .9) : null, off = css(c.accent, .18);
      if (style === 'capsule') return segmentRing(g, w / 2, h / 2, 12, 4, 16, 5, p, () => css(c.accent), off, glow);
      if (style === 'ring') {
        g.strokeStyle = css(c.accent, .35);g.lineWidth = 1;g.beginPath();g.arc(90, 90, 56, 0, Math.PI * 2);g.stroke();
        g.strokeStyle = css(c.text, .5);g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {const a = rad(i * 90);g.beginPath();g.moveTo(90 + Math.cos(a) * 75, 90 + Math.sin(a) * 75);g.lineTo(90 + Math.cos(a) * 81, 90 + Math.sin(a) * 81);g.stroke();}
        return segmentRing(g, 90, 90, 66, 9, 40, 3.5, p, t => css(mix(c.accent, c.accent2, t)), css(c.accent, .14), glow);
      }
      const n = 12, gap = 4, slant = h * Math.tan(rad(24)), segment = (w - slant - (n - 1) * gap) / n;
      for (let i = 0; i < n; i++) {
        const x = i * (segment + gap), f = Math.max(0, Math.min(1, p * n - i));
        g.save();g.beginPath();g.moveTo(x + slant, 0);g.lineTo(x + slant + segment, 0);g.lineTo(x + segment, h);g.lineTo(x, h);g.closePath();
        g.fillStyle = css(c.accent, .16);g.fill();g.strokeStyle = css(c.accent, .5);g.lineWidth = 1;g.stroke();
        if (f > 0) {g.clip();if (glow) {g.shadowColor = glow;g.shadowBlur = 6;}g.fillStyle = css(c.accent);g.fillRect(x, 0, (segment + slant) * f, h);}
        g.restore();
      }
    },
    y2k(g, w, h, p, c) {
      if (style !== 'ring') return blocksField(g, 0, 0, w, h, p, c);
      const title = g.createLinearGradient(3, 0, 177, 0);title.addColorStop(0, css(c.titleA));title.addColorStop(1, css(c.titleB));
      g.fillStyle = title;g.fillRect(3, 3, 174, 18);
      g.fillStyle = css(c.titleText);g.font = 'bold 11px Tahoma, "Microsoft YaHei", sans-serif';g.textBaseline = 'alphabetic';g.fillText('上班鼓励器', 8, 16);
      g.fillStyle = css(c.card);g.fillRect(157, 5, 16, 14);bevel(g, 157, 5, 16, 14, [css(c.b1), css(c.b4)], [css(c.b2), css(c.b3)]);
      g.strokeStyle = css(c.text);g.lineWidth = 1.5;g.beginPath();g.moveTo(162, 9);g.lineTo(168, 15);g.moveTo(168, 9);g.lineTo(162, 15);g.stroke();
      // A late-90s disk-space pie: the elapsed part of the day against what is left.
      const cx = 90, cy = 54, rx = 62, ry = 26, depth = 12, start = rad(-90), end = start + Math.PI * 2 * Math.min(1, p);
      const used = c.hl, free = mix(c.field, c.hl, .22), shade = col => css(mix(col, [0, 0, 0, 1], .45));
      for (let d = depth; d >= 0; d--) {
        const y = cy + d, top = d === 0;
        g.fillStyle = top ? css(free) : shade(free);ellipseSector(g, cx, y, rx, ry, 0, Math.PI * 2);g.fill();
        if (p > 0) {g.fillStyle = top ? css(used) : shade(used);ellipseSector(g, cx, y, rx, ry, start, end);g.fill();}
      }
      g.strokeStyle = css(c.b4);g.lineWidth = 1;
      g.beginPath();g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);g.stroke();
      g.beginPath();g.ellipse(cx, cy + depth, rx, ry, 0, 0, Math.PI);g.stroke();
      g.beginPath();g.moveTo(cx - rx, cy);g.lineTo(cx - rx, cy + depth);g.moveTo(cx + rx, cy);g.lineTo(cx + rx, cy + depth);g.stroke();
      if (p > 0 && p < 1) {g.beginPath();g.moveTo(cx, cy - ry);g.lineTo(cx, cy);g.lineTo(cx + Math.cos(end) * rx, cy + Math.sin(end) * ry);g.stroke();}
    },
    clay(g, w, h, p, c) {
      const fillArc = (cx, cy, r, width) => {
        const steps = Math.max(1, Math.ceil(360 * p / 3));g.lineWidth = width;g.lineCap = 'round';
        for (let i = 0; i < steps; i++) {
          g.strokeStyle = css(mix(c.accent, c.accent2, steps === 1 ? 1 : i / (steps - 1)));
          g.beginPath();g.arc(cx, cy, r, rad(-90 + 360 * p * i / steps), rad(-90 + 360 * p * (i + 1) / steps) + (i < steps - 1 ? .01 : 0));g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,.28)';g.lineWidth = width / 5;g.beginPath();g.arc(cx, cy, r - width / 5, rad(-90), rad(-90 + 360 * p));g.stroke();
      };
      const puff = (cx, cy, r) => {
        g.save();g.shadowColor = css(c.clayDrop);g.shadowBlur = r / 4;g.shadowOffsetY = r / 9;g.fillStyle = css(c.raised);g.beginPath();g.arc(cx, cy, r, 0, Math.PI * 2);g.fill();g.restore();
        g.save();g.beginPath();g.arc(cx, cy, r, 0, Math.PI * 2);g.clip();
        const light = g.createLinearGradient(0, cy - r, 0, cy + r);light.addColorStop(0, css(c.clayHi));light.addColorStop(.5, css(c.clayHi, 0));light.addColorStop(.72, css(c.clayLo, 0));light.addColorStop(1, css(c.clayLo));
        g.fillStyle = light;g.fillRect(cx - r, cy - r, r * 2, r * 2);g.restore();
      };
      if (style === 'capsule') {
        puff(20, 19, 18);
        g.strokeStyle = css(c.fill);g.lineWidth = 5;g.beginPath();g.arc(20, 19, 10.5, 0, Math.PI * 2);g.stroke();
        if (p > 0) fillArc(20, 19, 10.5, 5);
        return;
      }
      if (style === 'ring') {
        g.strokeStyle = css(c.fill);g.lineWidth = 16;g.beginPath();g.arc(90, 90, 72, 0, Math.PI * 2);g.stroke();
        if (p > 0) fillArc(90, 90, 72, 16);
        return puff(90, 90, 54);
      }
      const pill = (x, width) => {g.beginPath();g.roundRect(x, 0, width, h, h / 2);};
      pill(0, w);g.fillStyle = css(c.fill);g.fill();
      g.save();pill(0, w);g.clip();const inset = g.createLinearGradient(0, 0, 0, h);inset.addColorStop(0, css(c.clayLo));inset.addColorStop(.5, css(c.clayLo, 0));g.fillStyle = inset;g.fillRect(0, 0, w, h);g.restore();
      if (p > 0) {
        const width = Math.max(h, w * Math.min(1, p)), bar = g.createLinearGradient(0, 0, width, 0);bar.addColorStop(0, css(c.accent));bar.addColorStop(1, css(c.accent2));
        pill(0, width);g.fillStyle = bar;g.fill();
        g.save();pill(0, width);g.clip();const shine = g.createLinearGradient(0, 0, 0, h);shine.addColorStop(0, 'rgba(255,255,255,.4)');shine.addColorStop(.55, 'rgba(255,255,255,0)');g.fillStyle = shine;g.fillRect(0, 0, width, h);g.restore();
      }
    },
    lcd(g, w, h, p, c, dark) {
      const glow = dark ? css(c.lcdInk, .8) : null;
      const lit = (draw, on) => {g.save();if (on && glow) {g.shadowColor = glow;g.shadowBlur = 6;}draw();g.restore();};
      if (style === 'capsule') {
        const count = Math.floor(p * 5 + 1e-6);
        for (let i = 0; i < 5; i++) lit(() => {g.fillStyle = i < count ? css(c.lcdInk) : css(c.lcdGhost);g.fillRect(0, h - 4 - i * 6.5, w, 4);}, i < count);
        return;
      }
      if (style === 'ring') {
        const count = Math.floor(p * 60 + 1e-6);g.lineWidth = 3;g.lineCap = 'butt';
        for (let i = 0; i < 60; i++) {
          const a = rad(-90 + i * 6), inner = i % 5 === 0 ? 57 : 61;
          lit(() => {g.strokeStyle = i < count ? css(c.lcdInk) : css(c.lcdGhost);g.beginPath();g.moveTo(90 + Math.cos(a) * inner, 90 + Math.sin(a) * inner);g.lineTo(90 + Math.cos(a) * 70, 90 + Math.sin(a) * 70);g.stroke();}, i < count);
        }
        return;
      }
      const n = 16, gap = 3, segment = (w - (n - 1) * gap) / n, count = Math.floor(p * n + 1e-6), ink = dark ? c.lcdInk : c.text;
      for (let i = 0; i < n; i++) lit(() => {g.fillStyle = css(ink, i < count ? 1 : .2);g.fillRect(i * (segment + gap), 0, segment, h);}, i < count);
    },
  };
  function paintCustom(theme, progress) {
    const ratio = window.devicePixelRatio || 1, w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    const colours = Object.fromEntries(Object.entries(TOKENS).map(([key, name]) => [key, rgba(name)]));
    const dark = html.dataset.scheme === 'dark';
    const key = [theme, progress, ratio, w, h, dark, JSON.stringify(colours)].join(':');
    if (key === previousRing || !w || !h) return;previousRing = key;
    canvas.width = Math.round(w * ratio);canvas.height = Math.round(h * ratio);
    const g = canvas.getContext('2d');g.setTransform(ratio, 0, 0, ratio, 0, 0);g.clearRect(0, 0, w, h);
    painters[theme](g, w, h, progress, colours, dark);
    canvas.dataset.progress = String(progress);
  }

  const ghost = text => text.replace(/\d/g, '8');
  function sync() {
    const raw = Number(document.querySelector('.income-value')?.textContent), value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const parts = value.toFixed(2).split('.');integer.textContent = parts[0];decimal.textContent = '.' + parts[1];
    integer.dataset.ghost = ghost(parts[0]);decimal.dataset.ghost = '.88';
    amount.setAttribute('aria-label', '今日已赚 ' + value.toFixed(2) + ' 元');
    widget.classList.toggle('large-amount', value >= 10000);widget.classList.toggle('very-large-amount', value >= 1000000);
    widget.dataset.digits = String(parts[0].length);
    const source = document.querySelector('.countdown'), status = document.querySelector('.status');
    const off = status?.classList.contains('off'), finished = status?.classList.contains('finished');
    const values = [...(source?.querySelectorAll(':scope > span') || [])].map(node => node.textContent.padStart(2, '0'));
    timer.textContent = off ? '休息日' : finished ? '已下班' : values.length === 3 ? values.join(':') : '00:00:00';
    timer.dataset.ghost = off || finished ? '' : '88:88:88';
    timeLabel.textContent = off ? '今日安排' : finished ? '今日工作' : '距下班';
    widget.dataset.status = off ? 'off' : finished ? 'finished' : 'counting';
    widget.dataset.live = status?.classList.contains('working') ? 'on' : 'off';
    const reported = Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'));
    const progress = Math.max(0, Math.min(1, Number.isFinite(reported) ? reported / 100 : 0));
    widget.style.setProperty('--progress', String(progress));
    const look = html.dataset.style;
    if (CUSTOM.includes(look)) paintCustom(look, progress);
    else if (style === 'ring') paintRing(progress);
  }
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-valuenow']});
};
