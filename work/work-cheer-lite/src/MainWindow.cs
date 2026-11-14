using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace WorkCheerLite
{
    /// The full window: frameless, the page draws its own title bar. CSS app-region drag areas
    /// work natively (non-client region support); the edges post "resize" for the system sizing loop.
    class MainWindow : Form
    {
        readonly LiteApp app;
        readonly WebView2 web;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();
        FormWindowState lastState = FormWindowState.Normal;
        public bool PageReady { get; private set; }
        public bool AllowClosing;

        public MainWindow(LiteApp app)
        {
            this.app = app;
            Text = "上班鼓励器";
            Icon = app.AppIcon;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(0xEE, 0xF0, 0xF6);
            ShowInTaskbar = !Program.Smoke;
            web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
            Controls.Add(web);
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.Style |= 0x20000 /* WS_MINIMIZEBOX */ | 0x10000 /* WS_MAXIMIZEBOX */ | 0x80000 /* WS_SYSMENU */;
                cp.ClassStyle |= 0x20000 /* CS_DROPSHADOW */;
                return cp;
            }
        }

        public void PlaceInitially()
        {
            var zoom = DeviceDpi / 96f;
            MinimumSize = new Size((int)(380 * zoom), (int)(640 * zoom));
            var bounds = app.Prefs.FullBounds;
            if (bounds.IsEmpty)
            {
                var area = Screen.PrimaryScreen.WorkingArea;
                int width = Math.Min((int)(620 * zoom), area.Width), height = Math.Min((int)(1000 * zoom), area.Height);
                bounds = new Rectangle(area.X + (area.Width - width) / 2, area.Y + (area.Height - height) / 2, width, height);
            }
            Bounds = app.Clamp(bounds);
            UpdateMaximizedBounds();
            if (app.Prefs.FullMaximized) WindowState = FormWindowState.Maximized;
        }

        public async Task InitializeAsync()
        {
            var options = new CoreWebView2EnvironmentOptions(
                // The hidden full window keeps computing while the floating widget shows its numbers.
                "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling");
            options.Language = "zh-CN";
            var environment = await CoreWebView2Environment.CreateAsync(null, app.WebViewFolder, options);
            await web.EnsureCoreWebView2Async(environment);
            var core = web.CoreWebView2;
            var settings = core.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.AreDevToolsEnabled = Program.Args.ContainsKey("devtools");
            settings.IsStatusBarEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = false;
            settings.IsNonClientRegionSupportEnabled = true;
            await core.AddScriptToExecuteOnDocumentCreatedAsync(app.BridgeScript);
            core.WebMessageReceived += OnWebMessage;
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
            {
                if (!string.Equals(e.Uri, app.PageUri, StringComparison.OrdinalIgnoreCase)) e.Cancel = true;
            };
            core.ProcessFailed += delegate(object sender, CoreWebView2ProcessFailedEventArgs e) { app.PageError("WebView2 process failed: " + e.ProcessFailedKind); };
            core.Navigate(app.PageUri);
        }

        public Task<string> Eval(string script) { return web.CoreWebView2.ExecuteScriptAsync(script); }

        public void Zoom(double delta)
        {
            web.ZoomFactor = delta == 0 ? 1 : Math.Max(.5, Math.Min(2.5, web.ZoomFactor + delta));
        }

        public void RememberBounds()
        {
            if (Program.Smoke || WindowState == FormWindowState.Minimized) return;
            app.Prefs.FullBounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            app.Prefs.FullMaximized = WindowState == FormWindowState.Maximized;
            app.SaveSoon();
        }

        void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            if (!string.Equals(e.Source, app.PageUri, StringComparison.OrdinalIgnoreCase)) return;
            Dictionary<string, object> message;
            try { message = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); }
            catch (Exception) { return; }
            if (message == null) return;
            var type = Field(message, "type", "");
            if (type == "window") app.WindowAction(Field(message, "action", ""));
            else if (type == "resize") BeginResize(Field(message, "edge", ""));
            else if (type == "float") app.OnFloatData(ParseFloat(message));
            else if (type == "error") app.PageError(Field(message, "message", "script error"));
            else if (type == "ready") { PageReady = true; PushMaximized(); PushFloatTheme(); }
        }

        /// Answers the bridge's "ready": it starts reporting the widget's data once it knows the widget theme.
        void PushFloatTheme()
        {
            if (web.CoreWebView2 == null) return;
            web.CoreWebView2.PostWebMessageAsJson("{\"type\":\"floatTheme\",\"value\":" + json.Serialize(app.Prefs.FloatingTheme) + "}");
        }

        /// Switches the widget theme in the page and returns the widget's data measured in it (null if the page is not ready).
        public async Task<FloatData> ApplyFloatTheme(string theme)
        {
            var result = await Eval("window.__workCheerFloatTheme ? window.__workCheerFloatTheme(" + json.Serialize(theme) + ") : null");
            Dictionary<string, object> message = null;
            try { message = json.Deserialize<Dictionary<string, object>>(result); } catch (Exception) { }
            return message == null ? null : ParseFloat(message);
        }

        static FloatData ParseFloat(Dictionary<string, object> m)
        {
            var d = new FloatData();
            d.Earned = Field(m, "earned", d.Earned);
            d.Time = Field(m, "time", d.Time);
            d.Label = Field(m, "label", d.Label);
            d.Style = Field(m, "style", d.Style);
            d.Scheme = Field(m, "scheme", d.Scheme);
            object value;
            d.Live = m.TryGetValue("live", out value) && value is bool && (bool)value;
            if (m.TryGetValue("progress", out value) && value != null) d.Progress = (float)Math.Max(0, Math.Min(1, Convert.ToDouble(value, CultureInfo.InvariantCulture)));
            d.Card = FloatData.ParseColor(Field(m, "card", null), d.Card);
            d.Text = FloatData.ParseColor(Field(m, "text", null), d.Text);
            d.Muted = FloatData.ParseColor(Field(m, "muted", null), d.Muted);
            d.Accent = FloatData.ParseColor(Field(m, "accent", null), d.Accent);
            d.Accent2 = FloatData.ParseColor(Field(m, "accent2", null), d.Accent2);
            d.AccentText = FloatData.ParseColor(Field(m, "accentText", null), d.AccentText);
            d.Line = FloatData.ParseColor(Field(m, "line", null), d.Line);
            d.Edge = FloatData.ParseColor(Field(m, "edge", null), d.Edge);
            var tokens = m.TryGetValue("tokens", out value) ? value as Dictionary<string, object> : null;
            if (tokens != null)
                foreach (var pair in tokens)
                    if (pair.Value is string) d.Tokens[pair.Key] = FloatData.ParseColor((string)pair.Value, Color.Transparent);
            return d;
        }

        static string Field(Dictionary<string, object> m, string key, string fallback)
        {
            object value;
            return m.TryGetValue(key, out value) && value is string ? (string)value : fallback;
        }

        void BeginResize(string edge)
        {
            if (WindowState != FormWindowState.Normal) return;
            int hit;
            switch (edge)
            {
                case "w": hit = 10; break;
                case "e": hit = 11; break;
                case "n": hit = 12; break;
                case "nw": hit = 13; break;
                case "ne": hit = 14; break;
                case "s": hit = 15; break;
                case "sw": hit = 16; break;
                case "se": hit = 17; break;
                default: return;
            }
            NativeMethods.ReleaseCapture();
            NativeMethods.SendMessage(Handle, NativeMethods.WM_NCLBUTTONDOWN, new IntPtr(hit), IntPtr.Zero);
        }

        void PushMaximized()
        {
            if (web.CoreWebView2 == null) return;
            web.CoreWebView2.PostWebMessageAsJson(WindowState == FormWindowState.Maximized ? "{\"type\":\"maximized\",\"value\":true}" : "{\"type\":\"maximized\",\"value\":false}");
        }

        // A borderless window would cover the taskbar when maximized; MaximizedBounds is relative to its monitor.
        void UpdateMaximizedBounds()
        {
            var screen = Screen.FromHandle(Handle);
            var area = screen.WorkingArea;
            MaximizedBounds = new Rectangle(area.X - screen.Bounds.X, area.Y - screen.Bounds.Y, area.Width, area.Height);
        }

        protected override void OnMove(EventArgs e) { base.OnMove(e); if (IsHandleCreated) UpdateMaximizedBounds(); }
        protected override void OnResizeEnd(EventArgs e) { base.OnResizeEnd(e); RememberBounds(); }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            if (WindowState == lastState) return;
            lastState = WindowState;
            PushMaximized();
            if (Visible) RememberBounds();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!AllowClosing) { e.Cancel = true; app.WindowAction("close"); return; }
            base.OnFormClosing(e);
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.ShowMessage) { app.ShowCurrent(); return; }
            base.WndProc(ref m);
        }
    }
}
