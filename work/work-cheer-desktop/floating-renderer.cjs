// Reads the live calculator DOM; never writes salary settings or records.
module.exports = function mountFloating(style) {
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
  function sync() {
    const raw = Number(document.querySelector('.income-value')?.textContent), value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    const parts = value.toFixed(2).split('.');integer.textContent = parts[0];decimal.textContent = '.' + parts[1];
    amount.setAttribute('aria-label', '今日已赚 ' + value.toFixed(2) + ' 元');
    widget.classList.toggle('large-amount', value >= 10000);widget.classList.toggle('very-large-amount', value >= 1000000);
    const source = document.querySelector('.countdown'), status = document.querySelector('.status');
    const off = status?.classList.contains('off'), finished = status?.classList.contains('finished');
    const values = [...(source?.querySelectorAll(':scope > span') || [])].map(node => node.textContent.padStart(2, '0'));
    timer.textContent = off ? '休息日' : finished ? '已下班' : values.length === 3 ? values.join(':') : '00:00:00';
    timeLabel.textContent = off ? '今日安排' : finished ? '今日工作' : '距下班';
    widget.dataset.status = off ? 'off' : finished ? 'finished' : 'counting';
    widget.dataset.live = status?.classList.contains('working') ? 'on' : 'off';
    const reported = Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'));
    const progress = Math.max(0, Math.min(1, Number.isFinite(reported) ? reported / 100 : 0));
    widget.style.setProperty('--progress', String(progress));
    if (style === 'ring') paintRing(progress);
  }
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-valuenow']});
};
