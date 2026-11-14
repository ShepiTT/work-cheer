using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

namespace WorkCheerLite
{
    /// Owns the windows, tray, menus and preferences — the lite counterpart of the full edition's main.cjs.
    class LiteApp : ApplicationContext
    {
        public readonly string DataFolder, WebViewFolder, RuntimeFolder, PageUri, BridgeScript;
        public readonly Icon AppIcon;
        public readonly Prefs Prefs;
        public readonly MainWindow Main;
        public readonly FloatWidget Float;
        public FloatData LastFloat;
        public bool Migrated, Quitting;
        public int ExitCode;
        readonly NotifyIcon tray;
        readonly Timer saveTimer = new Timer { Interval = 300 };
        readonly Smoke smoke;
        bool floating;

        public LiteApp()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            DataFolder = Program.Args.ContainsKey("profile") ? Path.GetFullPath(Program.Args["profile"]) : Path.Combine(appData, "WorkCheerLite");
            WebViewFolder = Path.Combine(DataFolder, "WebView2");
            RuntimeFolder = Program.Smoke ? Path.Combine(DataFolder, "runtime")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WorkCheerLite", "runtime-" + Program.Version);
            Directory.CreateDirectory(DataFolder);
            Directory.CreateDirectory(RuntimeFolder);
            Extract("WebView2Loader.dll");
            Extract("index.html");
            CoreWebView2Environment.SetLoaderDllFolderPath(RuntimeFolder);
            PageUri = new Uri(Path.Combine(RuntimeFolder, "index.html")).AbsoluteUri;
            BridgeScript = ResourceText("bridge.js");
            using (var stream = Resource("icon.ico")) AppIcon = new Icon(stream);

            // The full edition (Electron) keeps its data in %APPDATA%\WorkCheer; the first launch copies it once.
            var fullEdition = Program.Args.ContainsKey("source-profile") ? Program.Args["source-profile"] : Program.Smoke ? null : Path.Combine(appData, "WorkCheer");
            var preferencesFile = Path.Combine(DataFolder, "preferences.json");
            var firstRun = !File.Exists(preferencesFile);
            Migrated = MigrateStorage(fullEdition);
            Prefs = new Prefs(preferencesFile);
            if (firstRun && fullEdition != null) Prefs.ImportFullEdition(Path.Combine(fullEdition, "desktop-preferences.json"));

            Main = new MainWindow(this);
            Float = new FloatWidget(this);
            tray = new NotifyIcon { Icon = AppIcon, Text = "上班鼓励器", Visible = !Program.Smoke, ContextMenuStrip = NewMenu() };
            tray.ContextMenuStrip.Opening += delegate { Fill(tray.ContextMenuStrip, "tray"); };
            tray.DoubleClick += delegate { ShowCurrent(); };
            saveTimer.Tick += delegate { saveTimer.Stop(); Prefs.Save(); };
            if (Program.Smoke) smoke = new Smoke(this);
            Start();
        }

        async void Start()
        {
            try
            {
                var handle = Main.Handle;
                Main.PlaceInitially();
                await Main.InitializeAsync();
                if (Prefs.Floating) SwitchMode(true, Prefs.FloatingStyle); else ShowFull();
                if (smoke != null) smoke.Run();
            }
            catch (Exception error) { Fail(error); }
        }

        public Rectangle WorkArea { get { return Screen.PrimaryScreen.WorkingArea; } }

        public void ShowFull()
        {
            floating = false;
            Float.Hide();
            Prefs.Floating = false;
            SaveSoon();
            if (Program.Smoke) { Main.Location = new Point(-30000, -30000); Main.Show(); return; }
            Main.Show();
            if (Main.WindowState == FormWindowState.Minimized) Main.WindowState = FormWindowState.Normal;
            Main.TopMost = Prefs.AlwaysOnTop;
            Main.Activate();
        }

        public void SwitchMode(bool toFloating, string style)
        {
            if (!toFloating) { ShowFull(); return; }
            if (Array.IndexOf(Prefs.Styles, style) < 0) style = Prefs.FloatingStyle;
            if (Main.Visible) { Main.RememberBounds(); Main.Hide(); }
            floating = true;
            Prefs.Floating = true;
            Prefs.FloatingStyle = style;
            SaveSoon();
            Point saved;
            Float.Feed(LastFloat ?? new FloatData());
            Float.ShowStyle(style, Prefs.FloatPositions.TryGetValue(style, out saved) ? (Point?)saved : null);
        }

        /// 1.12: picks the widget's own 主题 ("" follows the main window) and shows the widget, like picking a style.
        /// The page measures the new look first, so the widget is never shown in the old one.
        public async Task PickTheme(string id)
        {
            Prefs.FloatingTheme = Array.IndexOf(Prefs.Themes, id) >= 0 ? id : "";
            SaveSoon();
            if (Main.PageReady)
            {
                try
                {
                    var data = await Main.ApplyFloatTheme(Prefs.FloatingTheme);
                    if (data != null) OnFloatData(data);
                }
                catch (Exception error) { PageError("widget theme: " + error.Message); }
            }
            SwitchMode(true, null);
        }

        async void ClickTheme(string id) { await PickTheme(id); }

        public void ShowCurrent()
        {
            if (floating) { Float.Show(); Float.Repaint(true); if (!Program.Smoke) Float.Activate(); }
            else ShowFull();
        }

        public void WindowAction(string action)
        {
            if (action == "minimize") Main.WindowState = FormWindowState.Minimized;
            else if (action == "toggle-maximize") Main.WindowState = Main.WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
            else if (action == "close") { if (Prefs.CloseToTray) Main.Hide(); else Quit(0); }
            else if (action == "floating") SwitchMode(true, null);
            else if (action == "menu") ShowMenu("main", Cursor.Position);
        }

        public void OnFloatData(FloatData data)
        {
            LastFloat = data;
            Float.Feed(data);
        }

        public void FloatMoved()
        {
            var bounds = Clamp(Float.Bounds);
            if (bounds.Location != Float.Location) Float.Location = bounds.Location;
            Prefs.FloatPositions[Float.CurrentStyle] = bounds.Location;
            SaveSoon();
        }

        public Point DefaultFloatPosition(Size size)
        {
            var area = WorkArea;
            var zoom = size.Width / (float)FloatWidget.Designs[Float.CurrentStyle].Width;
            return new Point(area.Right - size.Width - (int)(24 * zoom), area.Top + (int)(40 * zoom));
        }

        /// Keeps a window on the screen it mostly overlaps, or brings it back to the primary one.
        public Rectangle Clamp(Rectangle bounds)
        {
            var screen = Screen.AllScreens.OrderByDescending(s => Overlap(s.WorkingArea, bounds)).First();
            var area = Overlap(screen.WorkingArea, bounds) > 0 ? screen.WorkingArea : Screen.PrimaryScreen.WorkingArea;
            int width = Math.Min(bounds.Width, area.Width), height = Math.Min(bounds.Height, area.Height);
            int x = Math.Max(area.Left, Math.Min(bounds.X, area.Right - width)), y = Math.Max(area.Top, Math.Min(bounds.Y, area.Bottom - height));
            return new Rectangle(x, y, width, height);
        }

        static long Overlap(Rectangle a, Rectangle b)
        {
            var r = Rectangle.Intersect(a, b);
            return r.IsEmpty ? 0 : (long)r.Width * r.Height;
        }

        public void ShowMenu(string kind, Point at)
        {
            var menu = NewMenu();
            Fill(menu, kind);
            menu.Closed += delegate { Main.BeginInvoke(new Action(menu.Dispose)); };
            menu.Show(at);
        }

        static ContextMenuStrip NewMenu() { return new ContextMenuStrip { RenderMode = ToolStripRenderMode.System, ShowImageMargin = false, ShowCheckMargin = true }; }

        // Mirrors the full edition's window, floating and tray menus.
        void Fill(ContextMenuStrip menu, string kind)
        {
            var items = menu.Items;
            items.Clear();
            if (kind == "tray") items.Add(Item("显示窗口", ShowCurrent));
            if (kind != "float") items.Add(Item(floating ? "返回完整窗口" : "进入悬浮窗", delegate { SwitchMode(!floating, null); }));
            var styles = new ToolStripMenuItem("悬浮窗样式");
            foreach (var id in Prefs.Styles)
            {
                var style = id;
                var entry = Item(StyleName(style), delegate { SwitchMode(true, style); });
                entry.Checked = Prefs.FloatingStyle == style;
                styles.DropDownItems.Add(entry);
            }
            items.Add(styles);
            var themes = new ToolStripMenuItem("悬浮窗主题");
            var follow = Item("跟随主窗口", delegate { ClickTheme(""); });
            follow.Checked = Prefs.FloatingTheme == "";
            themes.DropDownItems.Add(follow);
            themes.DropDownItems.Add(new ToolStripSeparator());
            for (var i = 0; i < Prefs.Themes.Length; i++)
            {
                var theme = Prefs.Themes[i];
                var entry = Item(Prefs.ThemeNames[i], delegate { ClickTheme(theme); });
                entry.Checked = Prefs.FloatingTheme == theme;
                themes.DropDownItems.Add(entry);
            }
            items.Add(themes);
            if (kind == "float")
            {
                items.Add(new ToolStripSeparator());
                var back = Item("返回完整窗口", delegate { SwitchMode(false, null); });
                back.ShortcutKeyDisplayString = "Esc";
                items.Add(back);
            }
            items.Add(Item("设置", OpenSettings));
            if (kind != "float")
            {
                var top = Item(floating ? "悬浮窗始终置顶" : "始终置顶", delegate { Prefs.AlwaysOnTop = !Prefs.AlwaysOnTop; Main.TopMost = Prefs.AlwaysOnTop; SaveSoon(); });
                top.Checked = floating || Prefs.AlwaysOnTop;
                top.Enabled = !floating;
                items.Add(top);
                var opacity = new ToolStripMenuItem("悬浮窗透明度");
                foreach (var choice in Prefs.OpacityChoices)
                {
                    var value = choice;
                    var entry = Item(value + "%", delegate { Prefs.Opacity = value; Float.Repaint(true); SaveSoon(); });
                    entry.Checked = Prefs.Opacity == value;
                    opacity.DropDownItems.Add(entry);
                }
                items.Add(opacity);
            }
            items.Add(new ToolStripSeparator());
            items.Add(Item("收起到托盘", HideToTray));
            if (kind != "float")
            {
                var closeToTray = Item("关闭窗口时收起到托盘", delegate { Prefs.CloseToTray = !Prefs.CloseToTray; SaveSoon(); });
                closeToTray.Checked = Prefs.CloseToTray;
                items.Add(closeToTray);
            }
            if (kind == "main")
            {
                items.Add(new ToolStripSeparator());
                items.Add(Item("放大", delegate { Main.Zoom(.1); }));
                items.Add(Item("缩小", delegate { Main.Zoom(-.1); }));
                items.Add(Item("恢复原始大小", delegate { Main.Zoom(0); }));
            }
            items.Add(new ToolStripSeparator());
            if (kind != "float") items.Add(Item("关于上班鼓励器", ShowAbout));
            items.Add(Item("退出", delegate { Quit(0); }));
        }

        static ToolStripMenuItem Item(string text, Action click)
        {
            var item = new ToolStripMenuItem(text);
            item.Click += delegate { click(); };
            return item;
        }

        static string StyleName(string id) { return id == "capsule" ? "极简胶囊" : id == "transparent" ? "透明悬字" : "倒计时圆环"; }

        void HideToTray()
        {
            if (floating) Float.Hide(); else Main.Hide();
        }

        async void OpenSettings()
        {
            ShowFull();
            try { await Main.Eval("document.querySelector('.settings-button')?.click()"); } catch (Exception) { }
        }

        void ShowAbout()
        {
            MessageBox.Show(Main.Visible ? Main : null,
                "上班鼓励器 " + Program.Version + "（轻量版）\n\n实时收入估算 · 下班倒计时 · 悬浮窗 · 托盘\n按住窗口顶部或卡片外空白处移动窗口；悬浮窗按住即可拖动，右键或 Esc 返回完整窗口。\n收入仅为估算，数据只保存在本机。\n\n界面运行在 Windows 自带的 Microsoft Edge WebView2 上。\n保存位置：" + DataFolder,
                "关于上班鼓励器", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        public void SaveSoon()
        {
            saveTimer.Stop();
            saveTimer.Start();
        }

        public void PageError(string message)
        {
            if (smoke != null) smoke.Error(message); else Log(message);
        }

        public void Quit(int code)
        {
            if (Quitting) return;
            Quitting = true;
            ExitCode = code;
            Main.RememberBounds();
            saveTimer.Stop();
            try { Prefs.Save(); } catch (Exception error) { Log(error.ToString()); }
            tray.Visible = false;
            tray.Dispose();
            Float.Close();
            Main.AllowClosing = true;
            Main.Close();
            ExitThread();
        }

        void Fail(Exception error)
        {
            Log(error.ToString());
            if (smoke != null) { smoke.Error(error.ToString()); smoke.Finish(); return; }
            var missing = error is WebView2RuntimeNotFoundException;
            MessageBox.Show(missing ? "这台电脑缺少 Microsoft Edge WebView2 运行时。\n请安装后再打开（Windows 10/11 一般已自带）：\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703" : "上班鼓励器启动失败：\n" + error.Message,
                "上班鼓励器", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Quit(1);
        }

        void Log(string message)
        {
            try { File.AppendAllText(Path.Combine(DataFolder, "startup-error.log"), DateTime.Now.ToString("s") + " " + message + Environment.NewLine); } catch (Exception) { }
        }

        bool MigrateStorage(string fullEditionProfile)
        {
            if (fullEditionProfile == null || Directory.Exists(Path.Combine(WebViewFolder, "EBWebView"))) return false;
            var source = Path.Combine(fullEditionProfile, "Local Storage", "leveldb");
            if (!Directory.Exists(source)) return false;
            // Both are Chromium localStorage for the file:// origin, so the database carries over as is.
            var target = Path.Combine(WebViewFolder, "EBWebView", "Default", "Local Storage", "leveldb");
            Directory.CreateDirectory(target);
            foreach (var file in Directory.GetFiles(source))
            {
                var name = Path.GetFileName(file);
                if (name == "LOCK") continue;
                try
                {
                    using (var input = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                    using (var output = File.Create(Path.Combine(target, name))) input.CopyTo(output);
                }
                catch (IOException error) { Log("migrate " + name + ": " + error.Message); }
            }
            return true;
        }

        void Extract(string name)
        {
            var target = Path.Combine(RuntimeFolder, name);
            byte[] bytes;
            using (var stream = Resource(name)) using (var copy = new MemoryStream()) { stream.CopyTo(copy); bytes = copy.ToArray(); }
            if (File.Exists(target) && File.ReadAllBytes(target).SequenceEqual(bytes)) return;
            var temp = target + ".tmp";
            File.WriteAllBytes(temp, bytes);
            if (File.Exists(target)) File.Replace(temp, target, null); else File.Move(temp, target);
        }

        static Stream Resource(string name)
        {
            var stream = typeof(LiteApp).Assembly.GetManifestResourceStream(name);
            if (stream == null) throw new InvalidOperationException("missing resource " + name);
            return stream;
        }

        static string ResourceText(string name)
        {
            using (var reader = new StreamReader(Resource(name))) return reader.ReadToEnd();
        }
    }
}
