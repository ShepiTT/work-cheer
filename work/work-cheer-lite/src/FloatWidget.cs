using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.Windows.Forms;

namespace WorkCheerLite
{
    /// What the page's bridge reports: the two values, today's progress and the current look's colours.
    class FloatData
    {
        public string Earned = "0.00", Time = "00:00:00", Label = "距下班", Style = "glass", Scheme = "light";
        public bool Live;
        public float Progress;
        public Color Card = Color.White, Text = Color.FromArgb(0x1D, 0x1D, 0x1F), Muted = Color.FromArgb(0x6E, 0x6E, 0x73);
        public Color Accent = Color.FromArgb(0x00, 0x7A, 0xFF), Accent2 = Color.FromArgb(0x32, 0xAD, 0xE6), AccentText = Color.FromArgb(0x00, 0x62, 0xCC);
        public Color Line = Color.FromArgb(31, 60, 60, 67), Edge = Color.FromArgb(184, 255, 255, 255);

        public bool Dark { get { return Scheme == "dark"; } }
        // Glass cannot blur the desktop behind a window, so it becomes a nearly opaque sheet (same rule as floating.css).
        public Color Surface { get { return Style == "glass" ? (Dark ? Color.FromArgb(230, 30, 30, 36) : Color.FromArgb(230, 255, 255, 255)) : Card; } }
        public Color Border { get { return Style == "glass" ? Edge : Line; } }
        public double Amount { get { double value; return double.TryParse(Earned, NumberStyles.Float, CultureInfo.InvariantCulture, out value) ? value : 0; } }

        public string Key { get { return string.Join("|", Earned, Time, Label, Style, Scheme, Live, Progress.ToString("0.000", CultureInfo.InvariantCulture), Card.ToArgb(), Text.ToArgb(), Muted.ToArgb(), Accent.ToArgb(), Accent2.ToArgb(), AccentText.ToArgb(), Border.ToArgb()); } }

        /// Accepts the forms getComputedStyle produces: rgb(), rgba(), color(srgb …) and #hex.
        public static Color ParseColor(string value, Color fallback)
        {
            if (string.IsNullOrEmpty(value)) return fallback;
            try
            {
                var text = value.Trim();
                if (text.StartsWith("#"))
                {
                    var hex = text.Substring(1);
                    if (hex.Length == 3) hex = string.Concat(hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]);
                    return Color.FromArgb(Convert.ToInt32(hex.Substring(0, 2), 16), Convert.ToInt32(hex.Substring(2, 2), 16), Convert.ToInt32(hex.Substring(4, 2), 16));
                }
                var open = text.IndexOf('(');
                var parts = text.Substring(open + 1).TrimEnd(')').Split(new[] { ',', ' ', '/' }, StringSplitOptions.RemoveEmptyEntries);
                var numbers = new List<double>();
                foreach (var part in parts)
                {
                    double number;
                    if (double.TryParse(part.TrimEnd('%'), NumberStyles.Float, CultureInfo.InvariantCulture, out number)) numbers.Add(part.EndsWith("%") ? number / 100 : number);
                }
                if (text.StartsWith("color(srgb") && numbers.Count >= 3)
                    return Color.FromArgb(Byte(numbers.Count > 3 ? numbers[3] * 255 : 255), Byte(numbers[0] * 255), Byte(numbers[1] * 255), Byte(numbers[2] * 255));
                if (text.StartsWith("rgb") && numbers.Count >= 3)
                    return Color.FromArgb(Byte(numbers.Count > 3 ? numbers[3] * 255 : 255), Byte(numbers[0]), Byte(numbers[1]), Byte(numbers[2]));
            }
            catch (Exception) { }
            return fallback;
        }

        static int Byte(double value) { return (int)Math.Max(0, Math.Min(255, Math.Round(value))); }
    }

    /// The floating widget: a per-pixel-alpha layered window painted with GDI+, so its rounded,
    /// see-through shapes need no browser. Drag is the system move loop (whole window is caption).
    class FloatWidget : Form
    {
        public static readonly Dictionary<string, Size> Designs = new Dictionary<string, Size>
        {
            { "capsule", new Size(360, 64) }, { "transparent", new Size(280, 180) }, { "ring", new Size(200, 200) },
        };
        static readonly string FontName = PickFont();
        readonly LiteApp app;
        string style = "capsule";
        FloatData data = new FloatData();
        string painted;

        public FloatWidget(LiteApp app)
        {
            this.app = app;
            Text = "上班鼓励器悬浮窗";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            KeyPreview = true;
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ExStyle |= 0x80000 /* WS_EX_LAYERED */ | 0x80 /* WS_EX_TOOLWINDOW */; return cp; }
        }

        public string CurrentStyle { get { return style; } }
        float Zoom { get { return (IsHandleCreated ? NativeMethods.GetDpiForWindow(Handle) : 96) / 96f; } }

        public Size PixelSize(string id)
        {
            var design = Designs[id];
            return new Size((int)Math.Round(design.Width * Zoom), (int)Math.Round(design.Height * Zoom));
        }

        public void ShowStyle(string id, Point? position)
        {
            style = id;
            if (!IsHandleCreated) CreateHandle();
            var size = PixelSize(id);
            var bounds = app.Clamp(new Rectangle(position.HasValue ? position.Value : app.DefaultFloatPosition(size), size));
            SetBounds(bounds.X, bounds.Y, bounds.Width, bounds.Height);
            if (!Visible) Show();
            Repaint(true);
            if (!Program.Smoke) Activate();
        }

        public void Feed(FloatData next)
        {
            data = next;
            if (Visible) Repaint(false);
        }

        public void Repaint(bool force)
        {
            var key = style + "|" + Zoom + "|" + app.Prefs.Opacity + "|" + data.Key;
            if (!force && key == painted) return;
            painted = key;
            using (var bitmap = Snapshot())
            {
                if (Size != bitmap.Size) Size = bitmap.Size;
                Present(bitmap);
            }
        }

        public Bitmap Snapshot()
        {
            var design = Designs[style];
            var zoom = Zoom;
            var bitmap = new Bitmap(Math.Max(1, (int)Math.Round(design.Width * zoom)), Math.Max(1, (int)Math.Round(design.Height * zoom)), PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bitmap))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.TextRenderingHint = TextRenderingHint.AntiAlias;
                g.ScaleTransform(zoom, zoom);
                if (style == "capsule") PaintCapsule(g);
                else if (style == "transparent") PaintTransparent(g);
                else PaintRing(g);
            }
            return bitmap;
        }

        // 极简胶囊: Live Activity pill — progress ring leading, countdown trailing in the accent.
        void PaintCapsule(Graphics g)
        {
            var pill = new RectangleF(4, 4, 352, 56);
            using (var path = Rounded(pill, 28)) Surface(g, path, pill, 2, 4);
            ProgressRing(g, 33, 32, 12.75f, 4.5f, data.Progress, data.Accent, data.Accent, Alpha(data.Accent, .22f), false);
            var moneySize = data.Amount >= 1000000 ? 16f : data.Amount >= 10000 ? 19f : 22f;
            using (var label = MakeFont(10.5f, false))
            using (var time = MakeFont(22, true))
            {
                float labelBase = Baseline(label, 12.4f, 14), valueTop = 27.4f;
                DrawText(g, "今日已赚", label, data.Muted, 60, labelBase);
                using (var whole = MakeFont(moneySize, true)) Money(g, 60, Baseline(whole, valueTop, 24.2f), moneySize, data.Text, data.Muted, .62f, .78f, 2, false);
                DrawText(g, data.Label, label, data.Muted, 334 - Measure(g, data.Label, label), labelBase);
                DrawText(g, data.Time, time, data.AccentText, 334 - Measure(g, data.Time, time), Baseline(time, valueTop, 24.2f));
            }
        }

        // 透明悬字: lock-screen type straight on the wallpaper; ink with a light halo, or white with a shadow when dark.
        void PaintTransparent(Graphics g)
        {
            var moneySize = data.Amount >= 1000000 ? 34f : data.Amount >= 10000 ? 44f : 58f;
            float top = (180 - (18 + 2 + moneySize + 8 + 24.2f + 8 + 2 + 5)) / 2, moneyTop = top + 20, timeTop = moneyTop + moneySize + 8;
            var minor = Alpha(data.Text, .82f);
            using (var label = MakeFont(13, false))
            using (var whole = MakeFont(moneySize, true))
            using (var time = MakeFont(22, true))
            {
                var labelBase = Baseline(label, top, 18);
                var dot = new RectangleF(16, labelBase - Ascent(label) * .62f, 7, 7);
                using (var brush = new SolidBrush(data.Live ? data.Accent : Alpha(data.Text, .5f))) g.FillEllipse(brush, dot);
                HaloText(g, "今日已赚", label, minor, 28, labelBase);
                Money(g, 16, Baseline(whole, moneyTop, moneySize), moneySize, data.Text, minor, .42f, .55f, 4, true);
                var timeBase = Baseline(time, timeTop, 24.2f);
                HaloText(g, data.Label, label, minor, 16, timeBase);
                HaloText(g, data.Time, time, data.Text, 16 + Measure(g, data.Label, label) + 8, timeBase);
            }
            var gauge = new RectangleF(16, timeTop + 24.2f + 10, 248, 5);
            using (var track = Rounded(gauge, 2.5f)) using (var brush = new SolidBrush(Alpha(data.Text, .24f))) g.FillPath(brush, track);
            if (data.Progress > 0)
                using (var fill = Rounded(new RectangleF(gauge.X, gauge.Y, Math.Max(5, gauge.Width * Math.Min(1, data.Progress)), gauge.Height), 2.5f))
                using (var brush = new SolidBrush(data.Accent)) g.FillPath(brush, fill);
        }

        // 倒计时圆环: an activity ring on a dial in the theme's surface.
        void PaintRing(Graphics g)
        {
            var disc = new RectangleF(10, 10, 180, 180);
            using (var path = new GraphicsPath()) { path.AddEllipse(disc); Surface(g, path, disc, 3, 5); }
            ProgressRing(g, 100, 100, 77, 14, data.Progress, data.Accent, data.Accent2, Alpha(data.Accent, .26f), true);
            var moneySize = data.Amount >= 1000000 ? 12f : data.Amount >= 10000 ? 14f : 16f;
            using (var label = MakeFont(10.5f, false))
            using (var time = MakeFont(28, true))
            using (var whole = MakeFont(moneySize, true))
            {
                float top = 100 - (13 + 2 + 30.8f + 6 + 13 + 2 + moneySize * 1.1f) / 2;
                Centered(g, data.Label, label, data.Muted, Baseline(label, top, 13));
                Centered(g, data.Time, time, data.Text, Baseline(time, top + 15, 30.8f));
                float moneyTop = top + 15 + 30.8f + 6;
                Centered(g, "今日已赚", label, data.Muted, Baseline(label, moneyTop, 13));
                var width = Money(g, 0, 0, moneySize, data.AccentText, data.Muted, .62f, .78f, 2, false, true);
                Money(g, 100 - width / 2, Baseline(whole, moneyTop + 15, moneySize * 1.1f), moneySize, data.AccentText, data.Muted, .62f, .78f, 2, false);
            }
        }

        void Surface(Graphics g, GraphicsPath path, RectangleF box, float drop, float blur)
        {
            var state = g.Save();
            g.TranslateTransform(0, drop);
            for (var i = (int)blur; i >= 1; i--)
                using (var pen = new Pen(Color.FromArgb(10, 0, 0, 0), i * 2f) { LineJoin = LineJoin.Round }) g.DrawPath(pen, path);
            g.Restore(state);
            using (var brush = new SolidBrush(data.Surface)) g.FillPath(brush, path);
            if (data.Style == "glass")
                using (var sheen = new LinearGradientBrush(box, Alpha(data.Accent, .16f), Color.FromArgb(0, data.Accent), 45f)) g.FillPath(sheen, path);
            using (var pen = new Pen(data.Border, 1f)) g.DrawPath(pen, path);
        }

        static void ProgressRing(Graphics g, float cx, float cy, float radius, float width, float progress, Color from, Color to, Color track, bool caps)
        {
            var box = new RectangleF(cx - radius, cy - radius, radius * 2, radius * 2);
            using (var pen = new Pen(track, width)) g.DrawEllipse(pen, box);
            if (progress <= 0) return;
            var sweep = 360f * Math.Min(1f, progress);
            var steps = Math.Max(1, (int)Math.Ceiling(sweep / 3f));
            for (var i = 0; i < steps; i++)
            {
                var colour = steps == 1 ? to : Mix(from, to, (float)i / (steps - 1));
                using (var pen = new Pen(colour, width)) g.DrawArc(pen, box, -90 + sweep * i / steps, sweep / steps + (i < steps - 1 ? .8f : 0));
            }
            if (!caps) return;
            var start = new PointF(cx, cy - radius);
            var endAngle = (-90 + sweep) * Math.PI / 180;
            var end = new PointF(cx + (float)Math.Cos(endAngle) * radius, cy + (float)Math.Sin(endAngle) * radius);
            using (var brush = new SolidBrush(from)) g.FillEllipse(brush, start.X - width / 2, start.Y - width / 2, width, width);
            for (var i = 4; i >= 1; i--)
                using (var shadow = new SolidBrush(Color.FromArgb(14, 0, 0, 0))) g.FillEllipse(shadow, end.X - width / 2 - i, end.Y - width / 2 - i + 1, width + i * 2, width + i * 2);
            using (var brush = new SolidBrush(to)) g.FillEllipse(brush, end.X - width / 2, end.Y - width / 2, width, width);
        }

        // ¥ + whole + .decimals on one baseline; returns the width.
        float Money(Graphics g, float x, float baseline, float size, Color main, Color minor, float currencyScale, float decimalScale, float gap, bool halo, bool measureOnly = false)
        {
            var parts = data.Earned.Split('.');
            var whole = parts[0];
            var fraction = "." + (parts.Length > 1 ? parts[1] : "00");
            using (var currencyFont = MakeFont(size * currencyScale, true))
            using (var wholeFont = MakeFont(size, true))
            using (var fractionFont = MakeFont(size * decimalScale, true))
            {
                float currencyWidth = Measure(g, "¥", currencyFont), wholeWidth = Measure(g, whole, wholeFont);
                if (!measureOnly)
                {
                    Draw(g, "¥", currencyFont, minor, x, baseline, halo);
                    Draw(g, whole, wholeFont, main, x + currencyWidth + gap, baseline, halo);
                    Draw(g, fraction, fractionFont, minor, x + currencyWidth + gap + wholeWidth, baseline, halo);
                }
                return currencyWidth + gap + wholeWidth + Measure(g, fraction, fractionFont);
            }
        }

        void Draw(Graphics g, string text, Font font, Color colour, float x, float baseline, bool halo)
        {
            if (halo) HaloText(g, text, font, colour, x, baseline); else DrawText(g, text, font, colour, x, baseline);
        }

        void HaloText(Graphics g, string text, Font font, Color colour, float x, float baseline)
        {
            var glow = data.Dark ? Color.FromArgb(46, 0, 0, 0) : Color.FromArgb(70, 255, 255, 255);
            for (var ring = 2; ring >= 1; ring--)
                for (var step = 0; step < 8; step++)
                {
                    var angle = step * Math.PI / 4;
                    DrawText(g, text, font, glow, x + (float)Math.Cos(angle) * ring, baseline + (float)Math.Sin(angle) * ring + (data.Dark ? 1 : 0));
                }
            DrawText(g, text, font, colour, x, baseline);
        }

        static void Centered(Graphics g, string text, Font font, Color colour, float baseline)
        {
            DrawText(g, text, font, colour, 100 - Measure(g, text, font) / 2, baseline);
        }

        static void DrawText(Graphics g, string text, Font font, Color colour, float x, float baseline)
        {
            using (var brush = new SolidBrush(colour)) g.DrawString(text, font, brush, x, baseline - Ascent(font), StringFormat.GenericTypographic);
        }

        static float Measure(Graphics g, string text, Font font)
        {
            return string.IsNullOrEmpty(text) ? 0 : g.MeasureString(text, font, PointF.Empty, StringFormat.GenericTypographic).Width;
        }

        static float Ascent(Font font) { return font.Size * font.FontFamily.GetCellAscent(font.Style) / font.FontFamily.GetEmHeight(font.Style); }
        static float Descent(Font font) { return font.Size * font.FontFamily.GetCellDescent(font.Style) / font.FontFamily.GetEmHeight(font.Style); }
        // Centres the glyph box in a CSS-style line box.
        static float Baseline(Font font, float top, float lineHeight) { return top + (lineHeight - Ascent(font) - Descent(font)) / 2 + Ascent(font); }

        static Font MakeFont(float pixels, bool bold) { return new Font(FontName, pixels, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel); }

        static string PickFont()
        {
            foreach (var name in new[] { "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI" })
                using (var font = new Font(name, 12)) if (font.Name == name) return name;
            return SystemFonts.MessageBoxFont.Name;
        }

        static GraphicsPath Rounded(RectangleF r, float radius)
        {
            var path = new GraphicsPath();
            var d = Math.Min(radius * 2, Math.Min(r.Width, r.Height));
            path.AddArc(r.X, r.Y, d, d, 180, 90);
            path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        static Color Alpha(Color c, float factor) { return Color.FromArgb((int)Math.Round(c.A * factor), c.R, c.G, c.B); }
        static Color Mix(Color a, Color b, float t)
        {
            return Color.FromArgb((int)(a.A + (b.A - a.A) * t), (int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
        }

        void Present(Bitmap bitmap)
        {
            IntPtr screen = NativeMethods.GetDC(IntPtr.Zero), memory = NativeMethods.CreateCompatibleDC(screen), hbitmap = IntPtr.Zero, previous = IntPtr.Zero;
            try
            {
                hbitmap = bitmap.GetHbitmap(Color.FromArgb(0));
                previous = NativeMethods.SelectObject(memory, hbitmap);
                var size = new NativeMethods.SIZE(bitmap.Width, bitmap.Height);
                var source = new NativeMethods.POINT(0, 0);
                var position = new NativeMethods.POINT(Left, Top);
                // Automated checks keep the widget invisible (and click-through) on the tester's desktop.
                var alpha = Program.Smoke ? 0 : (int)Math.Round(255 * app.Prefs.Opacity / 100.0);
                var blend = new NativeMethods.BLENDFUNCTION { BlendOp = 0, BlendFlags = 0, SourceConstantAlpha = (byte)alpha, AlphaFormat = 1 };
                NativeMethods.UpdateLayeredWindow(Handle, screen, ref position, ref size, memory, ref source, 0, ref blend, 2);
            }
            finally
            {
                if (previous != IntPtr.Zero) NativeMethods.SelectObject(memory, previous);
                if (hbitmap != IntPtr.Zero) NativeMethods.DeleteObject(hbitmap);
                NativeMethods.DeleteDC(memory);
                NativeMethods.ReleaseDC(IntPtr.Zero, screen);
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.WM_NCHITTEST) { m.Result = new IntPtr(NativeMethods.HTCAPTION); return; }
            if (m.Msg == NativeMethods.WM_CONTEXTMENU) { app.ShowMenu("float", Cursor.Position); return; }
            if (m.Msg == NativeMethods.WM_NCLBUTTONDBLCLK) return;
            base.WndProc(ref m);
            if (m.Msg == NativeMethods.WM_EXITSIZEMOVE) app.FloatMoved();
            else if (m.Msg == 0x02E0 /* WM_DPICHANGED: moved to a monitor with other scaling */ && Visible) Repaint(true);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) app.SwitchMode(false, null);
            base.OnKeyDown(e);
        }

        protected override void OnDpiChanged(DpiChangedEventArgs e)
        {
            base.OnDpiChanged(e);
            if (Visible) Repaint(true);
        }
    }
}
