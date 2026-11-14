using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;

namespace WorkCheerLite
{
    /// The floating widgets of the 1.10 themes (像素, 赛博朋克, 千禧, 黏土, 液晶), painted natively.
    /// Coordinates are CSS pixels and mirror the full edition's floating.css / floating-renderer.cjs:
    /// change both editions together. Window sizes: capsule 360×64, transparent 280×180, ring 200×200.
    partial class FloatWidget
    {
        static readonly string[] ThemedLooks = { "pixel", "cyber", "y2k", "clay", "lcd" };
        public static bool Themed(string look) { return Array.IndexOf(ThemedLooks, look) >= 0; }

        delegate void PartDrawer(int part, string text, Font font, Color colour, float x);

        // ── fonts ─────────────────────────────────────────────────────────────────────────────
        static PrivateFontCollection displayFonts;
        static FontFamily pixelFamily, lcdFamily;
        static readonly List<IntPtr> fontMemory = new List<IntPtr>();
        static readonly string BahnFont = Pick("Bahnschrift", "Segoe UI");
        static readonly string TahomaFont = Pick("Tahoma", "Segoe UI");
        static readonly string SongFont = Pick("SimSun", "NSimSun", "Microsoft YaHei UI", "Microsoft YaHei");

        static string Pick(params string[] names)
        {
            foreach (var name in names)
                using (var font = new Font(name, 12)) if (font.Name == name) return name;
            return SystemFonts.MessageBoxFont.Name;
        }

        /// The two numeral fonts drawn for this project (scripts/make-display-fonts.py), embedded as resources.
        static void LoadDisplayFonts()
        {
            if (displayFonts != null) return;
            displayFonts = new PrivateFontCollection();
            foreach (var name in new[] { "wc-pixel.ttf", "wc-lcd.ttf" })
                using (var stream = typeof(FloatWidget).Assembly.GetManifestResourceStream(name))
                {
                    if (stream == null) continue;
                    var bytes = new byte[stream.Length];
                    var read = 0;
                    while (read < bytes.Length) { var n = stream.Read(bytes, read, bytes.Length - read); if (n <= 0) break; read += n; }
                    var memory = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, memory, bytes.Length);
                    displayFonts.AddMemoryFont(memory, bytes.Length);
                    fontMemory.Add(memory);
                }
            foreach (var family in displayFonts.Families)
            {
                if (family.Name == "Work Cheer Pixel") pixelFamily = family;
                if (family.Name == "Work Cheer LCD") lcdFamily = family;
            }
        }

        public static bool DisplayFontsLoaded { get { LoadDisplayFonts(); return pixelFamily != null && lcdFamily != null; } }

        /// kind: pixel, lcd, bahn, tahoma, song, or anything else for the UI font (YaHei).
        static Font Face(string kind, float px, bool bold)
        {
            LoadDisplayFonts();
            if (kind == "pixel" && pixelFamily != null) return new Font(pixelFamily, px, FontStyle.Regular, GraphicsUnit.Pixel);
            if (kind == "lcd" && lcdFamily != null) return new Font(lcdFamily, px, FontStyle.Regular, GraphicsUnit.Pixel);
            if (kind == "bahn") return new Font(BahnFont, px, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel);
            if (kind == "tahoma") return new Font(TahomaFont, px, bold ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Pixel);
            if (kind == "song") return new Font(SongFont, px, FontStyle.Regular, GraphicsUnit.Pixel);
            return MakeFont(px, bold);
        }

        // ── shared bits ───────────────────────────────────────────────────────────────────────
        Color T(string name, Color fallback) { return data.Token(name, fallback); }
        string Whole { get { return data.Earned.Split('.')[0]; } }
        string Fraction { get { var parts = data.Earned.Split('.'); return "." + (parts.Length > 1 ? parts[1] : "00"); } }
        int Digits { get { return Whole.Length; } }
        bool Counting { get { return data.Time.IndexOf(':') >= 0; } }
        static string Ghost(string text) { var chars = text.ToCharArray(); for (var i = 0; i < chars.Length; i++) if (char.IsDigit(chars[i])) chars[i] = '8'; return new string(chars); }

        void PaintThemed(Graphics g)
        {
            if (data.Style == "pixel") Pixel(g);
            else if (data.Style == "cyber") Cyber(g);
            else if (data.Style == "y2k") Y2k(g);
            else if (data.Style == "clay") Clay(g);
            else Lcd(g);
        }

        /// ¥ + whole + .fraction on one baseline; draw == null draws plain text. Returns the width.
        static float MoneyRow(Graphics g, string whole, string fraction, float x, float baseline, Font cur, Font big, Font small, Color cc, Color wc, Color fc, float gap, PartDrawer draw, bool measureOnly)
        {
            float w0 = Measure(g, "¥", cur), w1 = Measure(g, whole, big), w2 = Measure(g, fraction, small);
            if (!measureOnly)
            {
                if (draw == null)
                {
                    DrawText(g, "¥", cur, cc, x, baseline);
                    DrawText(g, whole, big, wc, x + w0 + gap, baseline);
                    DrawText(g, fraction, small, fc, x + w0 + gap + w1, baseline);
                }
                else
                {
                    draw(0, "¥", cur, cc, x);
                    draw(1, whole, big, wc, x + w0 + gap);
                    draw(2, fraction, small, fc, x + w0 + gap + w1);
                }
            }
            return w0 + gap + w1 + w2;
        }

        /// Text drawn with offset copies underneath (a CSS text-shadow list without blur, last entry lowest).
        static void Offsets(Graphics g, string text, Font font, Color colour, float x, float baseline, float[] offsets, Color[] colours)
        {
            for (var i = colours.Length - 1; i >= 0; i--) DrawText(g, text, font, colours[i], x + offsets[i * 2], baseline + offsets[i * 2 + 1]);
            DrawText(g, text, font, colour, x, baseline);
        }

        /// A soft blur (CSS text-shadow with a radius), drawn as widening strokes of the glyph outlines.
        static void Glow(Graphics g, string text, Font font, float x, float baseline, Color colour, float radius)
        {
            if (string.IsNullOrEmpty(text) || colour.A == 0) return;
            using (var path = new GraphicsPath())
            {
                path.AddString(text, font.FontFamily, (int)font.Style, font.Size, new PointF(x, baseline - Ascent(font)), StringFormat.GenericTypographic);
                for (var i = 3; i >= 1; i--)
                    using (var pen = new Pen(Color.FromArgb((int)(colour.A * .09f), colour), radius * i / 2.4f) { LineJoin = LineJoin.Round })
                        g.DrawPath(pen, path);
            }
        }

        /// The light glow (light looks) or soft shadow (dark looks) every on-desktop text gets (--float-halo).
        void Halo(Graphics g, string text, Font font, float x, float baseline)
        {
            var glow = data.Dark ? Color.FromArgb(46, 0, 0, 0) : Color.FromArgb(70, 255, 255, 255);
            for (var ring = 2; ring >= 1; ring--)
                for (var step = 0; step < 8; step++)
                {
                    var angle = step * Math.PI / 4;
                    DrawText(g, text, font, glow, x + (float)Math.Cos(angle) * ring, baseline + (float)Math.Sin(angle) * ring + (data.Dark ? 1 : 0));
                }
        }

        static void Rect(Graphics g, Color colour, float x, float y, float w, float h)
        {
            if (w <= 0 || h <= 0 || colour.A == 0) return;
            using (var brush = new SolidBrush(colour)) g.FillRectangle(brush, x, y, w, h);
        }

        static void FillPath(Graphics g, GraphicsPath path, Color colour) { using (var brush = new SolidBrush(colour)) g.FillPath(brush, path); }

        /// Soft drop shadow under a shape: widening transparent strokes, offset down.
        static void SoftShadow(Graphics g, GraphicsPath path, Color colour, float dy, float blur)
        {
            if (colour.A == 0) return;
            var state = g.Save();
            g.TranslateTransform(0, dy);
            var steps = Math.Max(1, (int)Math.Ceiling(blur));
            for (var i = steps; i >= 1; i--)
                using (var pen = new Pen(Color.FromArgb((int)(colour.A / (steps + 1.5f)), colour), i * 2f) { LineJoin = LineJoin.Round }) g.DrawPath(pen, path);
            using (var brush = new SolidBrush(Color.FromArgb((int)(colour.A * .35f), colour))) g.FillPath(brush, path);
            g.Restore(state);
        }

        /// Shading inside a shape: light from the top edge, shade at the bottom edge (CSS inset shadows).
        static void InnerLight(Graphics g, GraphicsPath path, RectangleF box, Color top, float topSize, Color bottom, float bottomSize)
        {
            var state = g.Save();
            g.SetClip(path, CombineMode.Intersect);
            if (top.A > 0)
                using (var brush = new LinearGradientBrush(new RectangleF(box.X, box.Y - 1, box.Width, topSize + 1), top, Color.FromArgb(0, top), 90f))
                    g.FillRectangle(brush, box.X, box.Y, box.Width, topSize);
            if (bottom.A > 0)
                using (var brush = new LinearGradientBrush(new RectangleF(box.X, box.Bottom - bottomSize, box.Width, bottomSize + 1), Color.FromArgb(0, bottom), bottom, 90f))
                    g.FillRectangle(brush, box.X, box.Bottom - bottomSize, box.Width, bottomSize);
            g.Restore(state);
        }

        // ── 像素 ──────────────────────────────────────────────────────────────────────────────
        /// A notched 3px ink frame with a notched hard drop (--px-frame in floating.css).
        static void PixelFrame(Graphics g, RectangleF b, Color card, Color ink, Color drop)
        {
            foreach (var o in new[] { new PointF(8, 5), new PointF(2, 5), new PointF(5, 8), new PointF(5, 2) }) Rect(g, drop, b.X + o.X, b.Y + o.Y, b.Width, b.Height);
            foreach (var o in new[] { new PointF(0, -3), new PointF(0, 3), new PointF(-3, 0), new PointF(3, 0) }) Rect(g, ink, b.X + o.X, b.Y + o.Y, b.Width, b.Height);
            Rect(g, card, b.X, b.Y, b.Width, b.Height);
        }

        /// The cells around the edge of an n×n grid, lit clockwise starting at index `from`.
        static void Cells(Graphics g, float ox, float oy, int n, float size, float gap, int from, float lit, Color on, Color off)
        {
            var list = new List<Point>();
            for (var i = 0; i < n; i++) list.Add(new Point(i, 0));
            for (var i = 1; i < n; i++) list.Add(new Point(n - 1, i));
            for (var i = n - 2; i >= 0; i--) list.Add(new Point(i, n - 1));
            for (var i = n - 2; i >= 1; i--) list.Add(new Point(0, i));
            var count = (int)Math.Floor(lit * list.Count + 1e-6);
            for (var i = 0; i < list.Count; i++)
            {
                var cell = list[(i + from) % list.Count];
                float px = ox + cell.X * (size + gap), py = oy + cell.Y * (size + gap);
                Rect(g, i < count ? on : off, px, py, size, size);
                if (i < count) Rect(g, Color.FromArgb(89, 255, 255, 255), px, py, size, Math.Max(1, (float)Math.Round(size / 4)));
            }
        }

        void Pixel(Graphics g)
        {
            Color ink = T("ink", data.Text), drop = T("drop", Alpha(data.Text, .3f)), card = data.Card, off = Mix(card, ink, .18f);
            string whole = Whole, fraction = Fraction;
            if (style == "capsule")
            {
                PixelFrame(g, new RectangleF(6, 4, 342, 48), card, ink, drop);
                Cells(g, 16, 13, 4, 6, 2, 0, data.Progress, data.Accent, off);
                using (var label = MakeFont(11, true))
                using (var money = Face("pixel", data.Amount >= 1000000 ? 16 : 20, false))
                using (var time = Counting ? Face("pixel", 20, false) : MakeFont(16, true))
                {
                    DrawText(g, "今日已赚", label, data.Muted, 52, Baseline(label, 10, 14));
                    MoneyRow(g, whole, fraction, 52, Baseline(money, 27, 20), money, money, money, data.Muted, data.Text, data.Muted, 2, null, false);
                    DrawText(g, data.Label, label, data.Muted, 336 - Measure(g, data.Label, label), Baseline(label, 10, 14));
                    DrawText(g, data.Time, time, data.AccentText, 336 - Measure(g, data.Time, time), Baseline(time, 27, 20));
                }
                return;
            }
            if (style == "transparent")
            {
                float size = Digits <= 2 ? 50 : Digits <= 4 ? 40 : Digits <= 6 ? 30 : 20, top = (180 - (size + 80)) / 2;
                var outline = new float[] { 2, 0, -2, 0, 0, 2, 0, -2, 2, 2, -2, -2, 2, -2, -2, 2 };
                var outlineColours = new[] { card, card, card, card, card, card, card, card };
                float shift = data.Amount >= 1000000 ? 3 : 5;
                var withDrop = new float[outline.Length + 2]; outline.CopyTo(withDrop, 0); withDrop[outline.Length] = shift; withDrop[outline.Length + 1] = shift;
                var dropColours = new Color[9]; outlineColours.CopyTo(dropColours, 0); dropColours[8] = data.Accent;
                using (var label = MakeFont(13, true))
                using (var money = Face("pixel", size, false))
                using (var time = Counting ? Face("pixel", 20, false) : MakeFont(16, true))
                {
                    Offsets(g, "今日已赚", label, data.Text, 16, Baseline(label, top, 16), outline, outlineColours);
                    var baseline = Baseline(money, top + 24, size);
                    MoneyRow(g, whole, fraction, 16, baseline, money, money, money, data.Muted, data.Text, data.Muted, 2,
                        delegate (int part, string text, Font font, Color colour, float x) { Offsets(g, text, font, colour, x, baseline, withDrop, dropColours); }, false);
                    float row = top + 24 + size + 8, timeBase = Baseline(time, row, 20);
                    Offsets(g, data.Label, label, data.Text, 16, timeBase, outline, outlineColours);
                    Offsets(g, data.Time, time, data.Text, 16 + Measure(g, data.Label, label) + 8, timeBase, outline, outlineColours);
                    PixelCellRow(g, 16, row + 20 + 8 + 4, 250, 16, data.Progress, ink, card, data.Accent);
                }
                return;
            }
            PixelFrame(g, new RectangleF(8, 6, 180, 180), card, ink, drop);
            Cells(g, 19, 17, 9, 14, 4, 4, data.Progress, data.Accent, off);
            float y = 6 + (180 - 85) / 2f;
            using (var label = MakeFont(11, true))
            using (var time = Counting ? Face("pixel", 20, false) : MakeFont(16, true))
            using (var money = Digits <= 4 ? Face("pixel", 20, false) : MakeFont(14, true))
            {
                Centered(g, data.Label, label, data.Muted, Baseline(label, y, 14), 98);
                Centered(g, data.Time, time, data.Text, Baseline(time, y + 18, 20), 98);
                Centered(g, "今日已赚", label, data.Muted, Baseline(label, y + 47, 14), 98);
                var width = MoneyRow(g, whole, fraction, 0, 0, money, money, money, data.Muted, data.AccentText, data.Muted, 2, null, true);
                MoneyRow(g, whole, fraction, 98 - width / 2, Baseline(money, y + 65, 20), money, money, money, data.Muted, data.AccentText, data.Muted, 2, null, false);
            }
        }

        static void PixelCellRow(Graphics g, float ox, float oy, float w, float h, float p, Color ink, Color card, Color on)
        {
            const int n = 10; const float gap = 5;
            var box = (w - (n - 1) * gap) / n;
            for (var i = 0; i < n; i++)
            {
                float x = ox + i * (box + gap), f = Math.Max(0, Math.Min(1, p * n - i));
                Rect(g, ink, x + 2, oy, box - 4, 2); Rect(g, ink, x + 2, oy + h - 2, box - 4, 2); Rect(g, ink, x, oy + 2, 2, h - 4); Rect(g, ink, x + box - 2, oy + 2, 2, h - 4);
                Rect(g, card, x + 2, oy + 2, box - 4, h - 4);
                if (f <= 0) continue;
                Rect(g, on, x + 2, oy + 2, (box - 4) * f, h - 4);
                Rect(g, Color.FromArgb(102, 255, 255, 255), x + 2, oy + 2, (box - 4) * f, 3);
            }
        }

        static void Centered(Graphics g, string text, Font font, Color colour, float baseline, float centre)
        {
            DrawText(g, text, font, colour, centre - Measure(g, text, font) / 2, baseline);
        }

        // ── 赛博朋克 ──────────────────────────────────────────────────────────────────────────
        static GraphicsPath Chamfer(RectangleF b, float cut, bool octagon)
        {
            var path = new GraphicsPath();
            if (octagon)
                path.AddPolygon(new[] { new PointF(b.X + cut, b.Y), new PointF(b.Right - cut, b.Y), new PointF(b.Right, b.Y + cut), new PointF(b.Right, b.Bottom - cut),
                    new PointF(b.Right - cut, b.Bottom), new PointF(b.X + cut, b.Bottom), new PointF(b.X, b.Bottom - cut), new PointF(b.X, b.Y + cut) });
            else
                path.AddPolygon(new[] { new PointF(b.X + cut, b.Y), new PointF(b.Right, b.Y), new PointF(b.Right, b.Bottom - cut), new PointF(b.Right - cut, b.Bottom), new PointF(b.X, b.Bottom), new PointF(b.X, b.Y + cut) });
            return path;
        }

        void CyberFrame(Graphics g, RectangleF box, float cut, bool octagon, bool stripes)
        {
            using (var outer = Chamfer(box, cut, octagon))
            {
                if (!data.Dark)
                    using (var shadow = Chamfer(new RectangleF(box.X + 4, box.Y + 4, box.Width, box.Height), cut, octagon)) FillPath(g, shadow, data.Accent);
                else
                {
                    var glow = T("glow", Alpha(data.Accent, .55f));
                    for (var i = 3; i >= 1; i--)
                        using (var pen = new Pen(Color.FromArgb((int)(glow.A * .22f), glow), i * 3.4f) { LineJoin = LineJoin.Round }) g.DrawPath(pen, outer);
                }
                using (var brush = new LinearGradientBrush(box, T("frame-a", data.Text), T("frame-b", data.Text), 45f)) g.FillPath(brush, outer);
            }
            var inner = new RectangleF(box.X + 1.5f, box.Y + 1.5f, box.Width - 3, box.Height - 3);
            using (var fill = Chamfer(inner, cut - .6f, octagon)) FillPath(g, fill, data.Card);
            if (!stripes) return;
            var state = g.Save();
            g.SetClip(new RectangleF(inner.X + 168, inner.Y, 52, 3));
            using (var brush = new SolidBrush(data.Accent))
                for (var x = inner.X + 160; x < inner.X + 230; x += 11.31f)
                    g.FillPolygon(brush, new[] { new PointF(x, inner.Y + 3), new PointF(x + 3, inner.Y), new PointF(x + 8.66f, inner.Y), new PointF(x + 5.66f, inner.Y + 3) });
            g.Restore(state);
        }

        static void SegmentRing(Graphics g, float cx, float cy, float r, float width, int n, float gap, float lit, Func<float, Color> colourOf, Color off, bool glow)
        {
            var count = (int)Math.Floor(lit * n + 1e-6);
            var box = new RectangleF(cx - r, cy - r, r * 2, r * 2);
            for (var i = 0; i < n; i++)
            {
                float a0 = -90 + i * 360f / n + gap / 2, sweep = 360f / n - gap;
                var colour = i < count ? colourOf((float)i / Math.Max(1, n - 1)) : off;
                if (i < count && glow)
                    foreach (var extra in new[] { 7f, 4f })
                        using (var pen = new Pen(Color.FromArgb(50, colour), width + extra)) g.DrawArc(pen, box, a0, sweep);
                using (var pen = new Pen(colour, width)) g.DrawArc(pen, box, a0, sweep);
            }
        }

        void CyberLabel(Graphics g, string text, Font font, Color colour, float x, float baseline, bool halo)
        {
            if (halo) { Halo(g, "//", font, x, baseline); Halo(g, text, font, x + Measure(g, "//", font) + 3, baseline); }
            DrawText(g, "//", font, data.AccentText, x, baseline);
            DrawText(g, text, font, colour, x + Measure(g, "//", font) + 3, baseline);
        }

        float CyberLabelWidth(Graphics g, string text, Font font) { return Measure(g, "//", font) + 3 + Measure(g, text, font); }

        void Cyber(Graphics g)
        {
            string whole = Whole, fraction = Fraction;
            var glow = T("glow", Alpha(data.Accent, .55f));
            var split = new float[] { -1, 0, 1, 0 };
            var splitColours = new[] { Alpha(data.Accent2, .8f), Alpha(data.Accent, .8f) };
            if (style == "capsule")
            {
                CyberFrame(g, new RectangleF(6, 6, 344, 48), 12, false, true);
                SegmentRing(g, 32, 30, 12, 4, 16, 5, data.Progress, delegate (float t) { return data.Accent; }, Alpha(data.Accent, .18f), data.Dark);
                using (var label = MakeFont(10.5f, false))
                using (var big = Face("bahn", 22, true)) using (var cur = Face("bahn", 22 * .62f, true)) using (var small = Face("bahn", 22 * .78f, true))
                using (var time = Counting ? Face("bahn", 22, true) : MakeFont(22, true))
                {
                    CyberLabel(g, "今日已赚", label, data.Muted, 58, Baseline(label, 11, 13), false);
                    var baseline = Baseline(big, 26, 24.2f);
                    MoneyRow(g, whole, fraction, 58, baseline, cur, big, small, data.AccentText, data.Text, data.AccentText, 2,
                        delegate (int part, string text, Font font, Color colour, float x) { if (part == 1) Offsets(g, text, font, colour, x, baseline, split, splitColours); else DrawText(g, text, font, colour, x, baseline); }, false);
                    CyberLabel(g, data.Label, label, data.Muted, 334 - CyberLabelWidth(g, data.Label, label), Baseline(label, 11, 13), false);
                    float tx = 334 - Measure(g, data.Time, time), tb = Baseline(time, 26, 24.2f);
                    if (data.Dark) Glow(g, data.Time, time, tx, tb, glow, 10);
                    DrawText(g, data.Time, time, data.AccentText, tx, tb);
                }
                return;
            }
            if (style == "transparent")
            {
                float size = Digits >= 7 ? 34 : Digits >= 5 ? 44 : 56, top = (180 - (size + 74.2f)) / 2;
                var wide = new float[] { -2, 0, 2, 0 };
                var wideColours = new[] { Alpha(data.Accent2, .75f), Alpha(data.Accent, .75f) };
                using (var label = MakeFont(13, true))
                using (var big = Face("bahn", size, true)) using (var cur = Face("bahn", size * .62f, true)) using (var small = Face("bahn", size * .78f, true))
                using (var time = Counting ? Face("bahn", 22, true) : MakeFont(22, true))
                {
                    CyberLabel(g, "今日已赚", label, Alpha(data.Text, .82f), 16, Baseline(label, top, 16), true);
                    var baseline = Baseline(big, top + 18, size);
                    MoneyRow(g, whole, fraction, 16, baseline, cur, big, small, data.AccentText, data.Text, data.AccentText, 2,
                        delegate (int part, string text, Font font, Color colour, float x)
                        {
                            if (part != 1) { Halo(g, text, font, x, baseline); DrawText(g, text, font, colour, x, baseline); return; }
                            if (data.Dark) Glow(g, text, font, x, baseline, glow, 18); else Halo(g, text, font, x, baseline);
                            Offsets(g, text, font, colour, x, baseline, wide, wideColours);
                        }, false);
                    float row = top + 18 + size + 8, tb = Baseline(time, row, 24.2f), tx = 16 + CyberLabelWidth(g, data.Label, label) + 8;
                    CyberLabel(g, data.Label, label, Alpha(data.Text, .82f), 16, tb, true);
                    Halo(g, data.Time, time, tx, tb);
                    DrawText(g, data.Time, time, data.AccentText, tx, tb);
                    CyberSlants(g, 16, row + 24.2f + 8 + 4, 250, 12, data.Progress);
                }
                return;
            }
            CyberFrame(g, new RectangleF(8, 8, 180, 180), 40, true, false);
            using (var pen = new Pen(Alpha(data.Accent, .35f), 1)) g.DrawEllipse(pen, 98 - 56, 98 - 56, 112, 112);
            using (var pen = new Pen(Alpha(data.Text, .5f), 2))
                for (var i = 0; i < 4; i++)
                {
                    var a = i * Math.PI / 2;
                    g.DrawLine(pen, 98 + (float)Math.Cos(a) * 75, 98 + (float)Math.Sin(a) * 75, 98 + (float)Math.Cos(a) * 81, 98 + (float)Math.Sin(a) * 81);
                }
            SegmentRing(g, 98, 98, 66, 9, 40, 3.5f, data.Progress, delegate (float t) { return Mix(data.Accent, data.Accent2, t); }, Alpha(data.Accent, .14f), data.Dark);
            float moneySize = data.Amount >= 1000000 ? 13 : 16, height = 13 + 2 + 30.8f + 6 + 13 + 2 + moneySize * 1.1f, y = 8 + (180 - height) / 2;
            using (var label = MakeFont(10.5f, false))
            using (var time = Counting ? Face("bahn", 28, true) : MakeFont(24, true))
            using (var big = Face("bahn", moneySize, true)) using (var cur = Face("bahn", moneySize * .62f, true)) using (var small = Face("bahn", moneySize * .78f, true))
            {
                CyberLabel(g, data.Label, label, data.Muted, 98 - CyberLabelWidth(g, data.Label, label) / 2, Baseline(label, y, 13), false);
                float tb = Baseline(time, y + 15, 30.8f), tx = 98 - Measure(g, data.Time, time) / 2;
                Offsets(g, data.Time, time, data.Text, tx, tb, split, splitColours);
                float my = y + 15 + 30.8f + 6;
                CyberLabel(g, "今日已赚", label, data.Muted, 98 - CyberLabelWidth(g, "今日已赚", label) / 2, Baseline(label, my, 13), false);
                var width = MoneyRow(g, whole, fraction, 0, 0, cur, big, small, data.AccentText, data.AccentText, data.AccentText, 2, null, true);
                MoneyRow(g, whole, fraction, 98 - width / 2, Baseline(big, my + 15, moneySize * 1.1f), cur, big, small, data.AccentText, data.AccentText, data.AccentText, 2, null, false);
            }
        }

        void CyberSlants(Graphics g, float ox, float oy, float w, float h, float p)
        {
            const int n = 12; const float gap = 4;
            float slant = h * (float)Math.Tan(24 * Math.PI / 180), segment = (w - slant - (n - 1) * gap) / n;
            for (var i = 0; i < n; i++)
            {
                float x = ox + i * (segment + gap), f = Math.Max(0, Math.Min(1, p * n - i));
                using (var path = new GraphicsPath())
                {
                    path.AddPolygon(new[] { new PointF(x + slant, oy), new PointF(x + slant + segment, oy), new PointF(x + segment, oy + h), new PointF(x, oy + h) });
                    FillPath(g, path, Alpha(data.Accent, .16f));
                    using (var pen = new Pen(Alpha(data.Accent, .5f), 1)) g.DrawPath(pen, path);
                    if (f <= 0) continue;
                    var state = g.Save();
                    g.SetClip(path, CombineMode.Intersect);
                    if (data.Dark) Rect(g, Alpha(data.Accent, .3f), x - 3, oy - 3, (segment + slant) * f + 6, h + 6);
                    g.ResetClip();
                    g.SetClip(path, CombineMode.Replace);
                    Rect(g, data.Accent, x, oy, (segment + slant) * f, h);
                    g.Restore(state);
                }
            }
        }

        // ── 千禧 ──────────────────────────────────────────────────────────────────────────────
        static void Bevel(Graphics g, float x, float y, float w, float h, Color outerTopLeft, Color outerBottomRight, Color innerTopLeft, Color innerBottomRight)
        {
            Rect(g, outerBottomRight, x, y + h - 1, w, 1); Rect(g, outerBottomRight, x + w - 1, y, 1, h);
            Rect(g, outerTopLeft, x, y, w - 1, 1); Rect(g, outerTopLeft, x, y, 1, h - 1);
            Rect(g, innerBottomRight, x + 1, y + h - 2, w - 2, 1); Rect(g, innerBottomRight, x + w - 2, y + 1, 1, h - 2);
            Rect(g, innerTopLeft, x + 1, y + 1, w - 3, 1); Rect(g, innerTopLeft, x + 1, y + 1, 1, h - 3);
        }

        Color B(int n) { return T("b" + n, n <= 2 ? Color.White : Color.Black); }
        void Raised(Graphics g, float x, float y, float w, float h) { Rect(g, data.Card, x, y, w, h); Bevel(g, x, y, w, h, B(2), B(4), B(1), B(3)); }
        void Sunken(Graphics g, float x, float y, float w, float h) { Rect(g, T("field", Color.White), x, y, w, h); Bevel(g, x, y, w, h, B(3), B(1), B(4), B(2)); }

        void BlocksField(Graphics g, float x, float y, float w, float h, float lit)
        {
            Sunken(g, x, y, w, h);
            float inner = w - 6, block = 8, gap = 2;
            var count = (int)Math.Floor((inner * lit + gap) / (block + gap) + 1e-6);
            for (var i = 0; i < count; i++) Rect(g, T("hl", data.Accent), x + 3 + i * (block + gap), y + 3, Math.Min(block, inner - i * (block + gap)), h - 6);
        }

        /// White desktop-icon type with a hard black edge, readable on any wallpaper.
        static void IconText(Graphics g, string text, Font font, float x, float baseline)
        {
            var edge = Color.FromArgb(153, 0, 0, 0);
            for (var step = 0; step < 8; step++)
            {
                var angle = step * Math.PI / 4;
                DrawText(g, text, font, Color.FromArgb(50, 0, 0, 0), x + (float)Math.Cos(angle) * 2, baseline + (float)Math.Sin(angle) * 2);
            }
            Offsets(g, text, font, Color.White, x, baseline, new float[] { 1, 1, -1, 0, 1, 0, 0, -1, 0, 1 }, new[] { Color.Black, edge, edge, edge, edge });
        }

        void Y2k(Graphics g)
        {
            string whole = Whole, fraction = Fraction;
            if (style == "capsule")
            {
                Raised(g, 4, 4, 352, 56);
                using (var label = Face("song", 12, false))
                using (var big = Face("tahoma", 15, true)) using (var part = Face("tahoma", 15 * .85f, true))
                using (var time = Counting ? Face("tahoma", 15, true) : MakeFont(14, true))
                {
                    foreach (var field in new[] { 9f, 183f })
                    {
                        Sunken(g, field, 9, 168, 24);
                        DrawText(g, field < 100 ? "今日已赚" : data.Label, label, data.Text, field + 6, Baseline(label, 14, 14));
                    }
                    var width = MoneyRow(g, whole, fraction, 0, 0, part, big, part, data.Text, data.Text, data.Text, 2, null, true);
                    MoneyRow(g, whole, fraction, 9 + 168 - 7 - width, Baseline(big, 12, 18), part, big, part, data.Text, data.Text, data.Text, 2, null, false);
                    DrawText(g, data.Time, time, data.Text, 183 + 168 - 7 - Measure(g, data.Time, time), Baseline(time, 12, 18));
                }
                BlocksField(g, 9, 37, 342, 18, data.Progress);
                return;
            }
            if (style == "transparent")
            {
                float size = Digits >= 7 ? 28 : Digits >= 5 ? 36 : 48, top = (180 - (size + 80.2f)) / 2;
                using (var label = Face("song", 13, false))
                using (var big = Face("tahoma", size, true)) using (var part = Face("tahoma", size * .85f, true))
                using (var time = Counting ? Face("tahoma", 22, true) : MakeFont(20, true))
                {
                    IconText(g, "今日已赚", label, 16, Baseline(label, top, 16));
                    var baseline = Baseline(big, top + 18, size);
                    MoneyRow(g, whole, fraction, 16, baseline, part, big, part, Color.White, Color.White, Color.White, 2,
                        delegate (int index, string text, Font font, Color colour, float x) { IconText(g, text, font, x, baseline); }, false);
                    float row = top + 18 + size + 8, tb = Baseline(time, row, 24.2f);
                    IconText(g, data.Label, label, 16, tb);
                    IconText(g, data.Time, time, 16 + Measure(g, data.Label, label) + 8, tb);
                    BlocksField(g, 16, row + 24.2f + 8 + 4, 250, 18, data.Progress);
                }
                return;
            }
            Raised(g, 10, 10, 180, 180);
            Y2kDialog(g, 10, 10, data.Progress);
            using (var label = Face("song", 12, false))
            using (var time = Counting ? Face("tahoma", 17, true) : MakeFont(15, true))
            using (var big = Face("tahoma", 13, true)) using (var part = Face("tahoma", 13 * .85f, true))
            {
                DrawText(g, data.Label, label, data.Text, 16, Baseline(label, 108, 26));
                Sunken(g, 72, 108, 112, 26);
                DrawText(g, data.Time, time, data.Text, 178 - Measure(g, data.Time, time), Baseline(time, 108, 26));
                DrawText(g, "今日已赚", label, data.Text, 16, Baseline(label, 140, 22));
                Sunken(g, 72, 140, 112, 22);
                var width = MoneyRow(g, whole, fraction, 0, 0, part, big, part, data.Text, data.Text, data.Text, 2, null, true);
                MoneyRow(g, whole, fraction, 178 - width, Baseline(big, 140, 22), part, big, part, data.Text, data.Text, data.Text, 2, null, false);
            }
        }

        static PointF[] Sector(float cx, float cy, float rx, float ry, double from, double to, bool closeToCentre)
        {
            var points = new List<PointF>();
            if (closeToCentre) points.Add(new PointF(cx, cy));
            var steps = Math.Max(2, (int)Math.Ceiling(Math.Abs(to - from) / (Math.PI / 90)));
            for (var i = 0; i <= steps; i++)
            {
                var t = from + (to - from) * i / steps;
                points.Add(new PointF(cx + (float)(Math.Cos(t) * rx), cy + (float)(Math.Sin(t) * ry)));
            }
            return points.ToArray();
        }

        /// The ring style's dialog: a title bar and a late-90s disk-space pie of the day so far.
        void Y2kDialog(Graphics g, float ox, float oy, float p)
        {
            var state = g.Save();
            g.TranslateTransform(ox, oy);
            using (var brush = new LinearGradientBrush(new RectangleF(3, 3, 174, 18), T("title-a", Color.Navy), T("title-b", Color.Blue), 0f)) g.FillRectangle(brush, 3, 3, 174, 18);
            using (var font = MakeFont(11, true)) DrawText(g, "上班鼓励器", font, T("title-text", Color.White), 8, 16);
            Rect(g, data.Card, 157, 5, 16, 14);
            Bevel(g, 157, 5, 16, 14, B(1), B(4), B(2), B(3));
            using (var pen = new Pen(data.Text, 1.5f)) { g.DrawLine(pen, 162, 9, 168, 15); g.DrawLine(pen, 168, 9, 162, 15); }
            float cx = 90, cy = 54, rx = 62, ry = 26, depth = 12;
            double start = -Math.PI / 2, end = start + Math.PI * 2 * Math.Min(1, p);
            Color used = T("hl", data.Accent), free = Mix(T("field", Color.White), used, .22f);
            for (var d = (int)depth; d >= 0; d--)
            {
                var y = cy + d;
                using (var brush = new SolidBrush(d == 0 ? free : Mix(free, Color.Black, .45f))) g.FillPolygon(brush, Sector(cx, y, rx, ry, 0, Math.PI * 2, false));
                if (p > 0) using (var brush = new SolidBrush(d == 0 ? used : Mix(used, Color.Black, .45f))) g.FillPolygon(brush, Sector(cx, y, rx, ry, start, end, true));
            }
            using (var pen = new Pen(B(4), 1))
            {
                g.DrawPolygon(pen, Sector(cx, cy, rx, ry, 0, Math.PI * 2, false));
                g.DrawLines(pen, Sector(cx, cy + depth, rx, ry, 0, Math.PI, false));
                g.DrawLine(pen, cx - rx, cy, cx - rx, cy + depth);
                g.DrawLine(pen, cx + rx, cy, cx + rx, cy + depth);
                if (p > 0 && p < 1) g.DrawLines(pen, new[] { new PointF(cx, cy - ry), new PointF(cx, cy), new PointF(cx + (float)Math.Cos(end) * rx, cy + (float)Math.Sin(end) * ry) });
            }
            g.Restore(state);
        }

        // ── 黏土 ──────────────────────────────────────────────────────────────────────────────
        void ClayPuff(Graphics g, float cx, float cy, float r)
        {
            using (var path = new GraphicsPath())
            {
                path.AddEllipse(cx - r, cy - r, r * 2, r * 2);
                SoftShadow(g, path, T("clay-drop", Color.FromArgb(80, 0, 0, 0)), r / 9, r / 4);
                FillPath(g, path, T("raised", data.Card));
                InnerLight(g, path, new RectangleF(cx - r, cy - r, r * 2, r * 2), T("clay-hi", Color.FromArgb(200, 255, 255, 255)), r, T("clay-lo", Color.FromArgb(40, 0, 0, 0)), r * .56f);
            }
        }

        void ClayArc(Graphics g, float cx, float cy, float r, float width, float p)
        {
            var box = new RectangleF(cx - r, cy - r, r * 2, r * 2);
            var steps = Math.Max(1, (int)Math.Ceiling(360 * p / 3));
            for (var i = 0; i < steps; i++)
                using (var pen = new Pen(Mix(data.Accent, data.Accent2, steps == 1 ? 1 : (float)i / (steps - 1)), width) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    g.DrawArc(pen, box, -90 + 360 * p * i / steps, 360 * p / steps + (i < steps - 1 ? .6f : 0));
            var shine = r - width / 5;
            using (var pen = new Pen(Color.FromArgb(71, 255, 255, 255), width / 5) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                if (p > 0) g.DrawArc(pen, cx - shine, cy - shine, shine * 2, shine * 2, -90, 360 * p);
        }

        void ClayRing(Graphics g, float cx, float cy, float r, float width, float p)
        {
            using (var pen = new Pen(T("fill", Alpha(data.Accent, .15f)), width)) g.DrawEllipse(pen, cx - r, cy - r, r * 2, r * 2);
            if (p > 0) ClayArc(g, cx, cy, r, width, p);
        }

        void ClayBody(Graphics g, GraphicsPath shape, RectangleF box, float dropY, float blur, float lightSize, float shadeSize)
        {
            SoftShadow(g, shape, T("clay-drop", Color.FromArgb(80, 0, 0, 0)), dropY, blur);
            FillPath(g, shape, data.Card);
            InnerLight(g, shape, box, T("clay-hi", Color.FromArgb(200, 255, 255, 255)), lightSize, T("clay-lo", Color.FromArgb(40, 0, 0, 0)), shadeSize);
        }

        void ClayPill(Graphics g, float x, float y, float w, float h, float p)
        {
            using (var track = Rounded(new RectangleF(x, y, w, h), h / 2))
            {
                FillPath(g, track, T("fill", Alpha(data.Accent, .15f)));
                InnerLight(g, track, new RectangleF(x, y, w, h), T("clay-lo", Color.FromArgb(40, 0, 0, 0)), h / 2, Color.Transparent, 0);
            }
            if (p <= 0) return;
            var width = Math.Max(h, w * Math.Min(1, p));
            var bar = new RectangleF(x, y, width, h);
            using (var path = Rounded(bar, h / 2))
            {
                using (var brush = new LinearGradientBrush(new RectangleF(x - 1, y, width + 2, h), data.Accent, data.Accent2, 0f)) g.FillPath(brush, path);
                InnerLight(g, path, bar, Color.FromArgb(102, 255, 255, 255), h * .55f, Color.Transparent, 0);
            }
        }

        void Clay(Graphics g)
        {
            string whole = Whole, fraction = Fraction;
            if (style == "capsule")
            {
                var box = new RectangleF(4, 3, 352, 52);
                using (var path = Rounded(box, 26)) ClayBody(g, path, box, 4, 3, 7, 8);
                ClayPuff(g, 30, 28, 18);
                ClayRing(g, 30, 28, 10.5f, 5, data.Progress);
                using (var label = MakeFont(10.5f, true))
                using (var big = MakeFont(21, true)) using (var cur = MakeFont(21 * .62f, true)) using (var small = MakeFont(21 * .78f, true))
                {
                    DrawText(g, "今日已赚", label, data.Muted, 60, Baseline(label, 10, 13));
                    MoneyRow(g, whole, fraction, 60, Baseline(big, 24, 24), cur, big, small, data.AccentText, data.Text, data.Muted, 2, null, false);
                    DrawText(g, data.Label, label, data.Muted, 336 - Measure(g, data.Label, label), Baseline(label, 10, 13));
                    DrawText(g, data.Time, big, data.AccentText, 336 - Measure(g, data.Time, big), Baseline(big, 24, 24));
                }
                return;
            }
            if (style == "transparent")
            {
                float size = Digits >= 7 ? 34 : Digits >= 5 ? 44 : 56, top = (180 - (size + 78.2f)) / 2;
                var lift = new float[] { 0, 2, 0, 4 };
                var liftColours = new[] { Mix(data.Card, data.Accent, .5f), Mix(data.Card, data.Accent, .3f) };
                using (var label = MakeFont(13, true))
                using (var big = MakeFont(size, true)) using (var cur = MakeFont(size * .62f, true)) using (var small = MakeFont(size * .78f, true))
                using (var time = MakeFont(22, true))
                {
                    float lb = Baseline(label, top, 16);
                    Halo(g, "今日已赚", label, 16, lb); DrawText(g, "今日已赚", label, Alpha(data.Text, .82f), 16, lb);
                    var baseline = Baseline(big, top + 18, size);
                    MoneyRow(g, whole, fraction, 16, baseline, cur, big, small, data.AccentText, data.Text, data.Muted, 2,
                        delegate (int part, string text, Font font, Color colour, float x)
                        {
                            Halo(g, text, font, x, baseline);
                            if (part == 1) Offsets(g, text, font, colour, x, baseline, lift, liftColours); else DrawText(g, text, font, colour, x, baseline);
                        }, false);
                    float row = top + 18 + size + 8, tb = Baseline(time, row, 24.2f), tx = 16 + Measure(g, data.Label, label) + 8;
                    Halo(g, data.Label, label, 16, tb); DrawText(g, data.Label, label, Alpha(data.Text, .82f), 16, tb);
                    Halo(g, data.Time, time, tx, tb); DrawText(g, data.Time, time, data.AccentText, tx, tb);
                    ClayPill(g, 16, row + 24.2f + 8 + 4, 250, 16, data.Progress);
                }
                return;
            }
            var disc = new RectangleF(10, 8, 180, 180);
            using (var path = new GraphicsPath()) { path.AddEllipse(disc); ClayBody(g, path, disc, 4, 4, 12, 14); }
            ClayRing(g, 100, 98, 72, 16, data.Progress);
            ClayPuff(g, 100, 98, 54);
            float moneySize = data.Amount >= 1000000 ? 12 : 15, y = 8 + (180 - 76) / 2f;
            using (var label = MakeFont(10, true))
            using (var time = MakeFont(24, true))
            using (var big = MakeFont(moneySize, true)) using (var cur = MakeFont(moneySize * .62f, true)) using (var small = MakeFont(moneySize * .78f, true))
            {
                Centered(g, data.Label, label, data.Muted, Baseline(label, y, 12), 100);
                Centered(g, data.Time, time, data.Text, Baseline(time, y + 13, 28), 100);
                Centered(g, "今日已赚", label, data.Muted, Baseline(label, y + 45, 12), 100);
                var width = MoneyRow(g, whole, fraction, 0, 0, cur, big, small, data.AccentText, data.AccentText, data.Muted, 2, null, true);
                MoneyRow(g, whole, fraction, 100 - width / 2, Baseline(big, y + 58, 18), cur, big, small, data.AccentText, data.AccentText, data.Muted, 2, null, false);
            }
        }

        // ── 液晶 ──────────────────────────────────────────────────────────────────────────────
        void Shell(Graphics g, RectangleF box, float radius)
        {
            using (var path = Rounded(box, radius))
            {
                SoftShadow(g, path, Color.FromArgb(60, 0, 0, 0), 2, 2);
                using (var brush = new LinearGradientBrush(new RectangleF(box.X, box.Y - 1, box.Width, box.Height + 2), data.Card, data.Card, 90f))
                {
                    brush.InterpolationColors = new ColorBlend { Colors = new[] { Mix(data.Card, Color.White, .1f), data.Card, Mix(data.Card, Color.Black, .07f) }, Positions = new[] { 0f, .34f, 1f } };
                    g.FillPath(brush, path);
                }
                var state = g.Save();
                g.SetClip(path, CombineMode.Intersect);
                Rect(g, T("shell-hi", Color.FromArgb(190, 255, 255, 255)), box.X, box.Y, box.Width, 1);
                Rect(g, Color.FromArgb(36, 0, 0, 0), box.X, box.Bottom - 2, box.Width, 2);
                g.Restore(state);
            }
        }

        void Screen(Graphics g, RectangleF screen, float radius)
        {
            using (var bezel = Rounded(RectangleF.Inflate(screen, 3, 3), radius + 3)) FillPath(g, bezel, T("bezel", Color.Black));
            using (var path = Rounded(screen, radius))
            {
                FillPath(g, path, T("lcd", data.Card));
                InnerLight(g, path, screen, Color.FromArgb(77, 0, 0, 0), 5, Color.Transparent, 0);
            }
        }

        /// Segment text with its unlit "8" ghost behind, glowing when the look is dark.
        void LcdText(Graphics g, string text, string ghost, Font font, Color ink, Color ghostColour, float x, float baseline, bool glow)
        {
            if (!string.IsNullOrEmpty(ghost)) DrawText(g, ghost, font, ghostColour, x, baseline);
            if (glow) Glow(g, text, font, x, baseline, Alpha(data.Accent, .6f), 14);
            DrawText(g, text, font, ink, x, baseline);
        }

        void LcdMoney(Graphics g, float x, float baseline, float size, Color ink, Color ghost, bool glow, bool halo, bool measureOnly, out float width)
        {
            string whole = Whole, fraction = Fraction;
            using (var cur = MakeFont(size * (halo ? .4f : .5f), true))
            using (var digits = Face("lcd", size, false))
            {
                width = MoneyRow(g, whole, fraction, x, baseline, cur, digits, digits, ink, ink, ink, 3, null, true);
                if (measureOnly) return;
                MoneyRow(g, whole, fraction, x, baseline, cur, digits, digits, ink, ink, ink, 3,
                    delegate (int part, string text, Font font, Color colour, float px)
                    {
                        if (halo) Halo(g, text, font, px, baseline);
                        if (part == 0) DrawText(g, text, font, colour, px, baseline);
                        else LcdText(g, text, part == 1 ? Ghost(text) : ".88", font, colour, ghost, px, baseline, glow);
                    }, false);
            }
        }

        void Lcd(Graphics g)
        {
            Color ink = T("lcd-ink", data.Text), dim = T("lcd-dim", data.Muted), ghost = T("lcd-ghost", Alpha(data.Text, .08f));
            bool glow = data.Dark;
            float width;
            if (style == "capsule")
            {
                Shell(g, new RectangleF(4, 4, 352, 56), 16);
                Screen(g, new RectangleF(10, 10, 340, 44), 9);
                var count = (int)Math.Floor(data.Progress * 5 + 1e-6);
                for (var i = 0; i < 5; i++)
                {
                    float y = 17 + 30 - 4 - i * 6.5f;
                    if (i < count && glow) Rect(g, Alpha(ink, .25f), 19, y - 2, 24, 8);
                    Rect(g, i < count ? ink : ghost, 21, y, 20, 4);
                }
                using (var label = MakeFont(9, true))
                using (var time = Counting ? Face("lcd", 26, false) : MakeFont(16, true))
                {
                    DrawText(g, "今日已赚", label, dim, 52, Baseline(label, 12, 11));
                    using (var digits = Face("lcd", 26, false)) LcdMoney(g, 52, Baseline(digits, 25, 28), 26, ink, ghost, glow, false, false, out width);
                    DrawText(g, data.Label, label, dim, 338 - Measure(g, data.Label, label), Baseline(label, 12, 11));
                    LcdText(g, data.Time, Counting ? "88:88:88" : "", time, ink, ghost, 338 - Measure(g, data.Time, time), Baseline(time, 25, 28), glow && Counting);
                }
                return;
            }
            if (style == "transparent")
            {
                float size = Digits >= 7 ? 36 : Digits >= 5 ? 46 : 60, top = (180 - (size + 78.6f)) / 2;
                Color colour = glow ? ink : data.Text, faint = glow ? Alpha(ink, .16f) : Alpha(data.Text, .14f);
                using (var label = MakeFont(13, true))
                using (var digits = Face("lcd", size, false))
                using (var time = Counting ? Face("lcd", 26, false) : MakeFont(16, true))
                {
                    float lb = Baseline(label, top, 16);
                    Halo(g, "今日已赚", label, 16, lb); DrawText(g, "今日已赚", label, Alpha(data.Text, .82f), 16, lb);
                    LcdMoney(g, 16, Baseline(digits, top + 18, size), size, colour, faint, glow, true, false, out width);
                    float row = top + 18 + size + 8, tb = Baseline(time, row, 28.6f), tx = 16 + Measure(g, data.Label, label) + 8;
                    Halo(g, data.Label, label, 16, tb); DrawText(g, data.Label, label, Alpha(data.Text, .82f), 16, tb);
                    Halo(g, data.Time, time, tx, tb);
                    LcdText(g, data.Time, Counting ? "88:88:88" : "", time, colour, faint, tx, tb, glow && Counting);
                    float y = row + 28.6f + 8 + 4, segment = (250 - 15 * 3) / 16f;
                    var lit = (int)Math.Floor(data.Progress * 16 + 1e-6);
                    for (var i = 0; i < 16; i++)
                    {
                        if (i < lit && glow) Rect(g, Alpha(colour, .25f), 16 + i * (segment + 3) - 2, y - 2, segment + 4, 16);
                        Rect(g, Alpha(colour, i < lit ? 1 : .2f), 16 + i * (segment + 3), y, segment, 12);
                    }
                }
                return;
            }
            Shell(g, new RectangleF(10, 10, 180, 180), 44);
            Screen(g, new RectangleF(19, 19, 162, 162), 34);
            var ticks = (int)Math.Floor(data.Progress * 60 + 1e-6);
            for (var i = 0; i < 60; i++)
            {
                var a = (-90 + i * 6) * Math.PI / 180;
                float inner = i % 5 == 0 ? 57 : 61, cos = (float)Math.Cos(a), sin = (float)Math.Sin(a);
                if (i < ticks && glow) using (var pen = new Pen(Alpha(ink, .3f), 6)) g.DrawLine(pen, 100 + cos * inner, 100 + sin * inner, 100 + cos * 70, 100 + sin * 70);
                using (var pen = new Pen(i < ticks ? ink : ghost, 3)) g.DrawLine(pen, 100 + cos * inner, 100 + sin * inner, 100 + cos * 70, 100 + sin * 70);
            }
            float moneySize = data.Amount >= 1000000 ? 15 : 18, top2 = 10 + (180 - 83) / 2f;
            using (var label = MakeFont(9, true))
            using (var time = Counting ? Face("lcd", 30, false) : MakeFont(16, true))
            using (var digits = Face("lcd", moneySize, false))
            {
                Centered(g, data.Label, label, dim, Baseline(label, top2, 11), 100);
                LcdText(g, data.Time, Counting ? "88:88:88" : "", time, ink, ghost, 100 - Measure(g, data.Time, time) / 2, Baseline(time, top2 + 13, 32), glow && Counting);
                Centered(g, "今日已赚", label, dim, Baseline(label, top2 + 50, 11), 100);
                var baseline = Baseline(digits, top2 + 63, 20);
                LcdMoney(g, 0, baseline, moneySize, ink, ghost, glow, false, true, out width);
                LcdMoney(g, 100 - width / 2, baseline, moneySize, ink, ghost, glow, false, false, out width);
            }
        }
    }
}
