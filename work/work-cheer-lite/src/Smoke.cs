using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace WorkCheerLite
{
    /// --smoke: automated checks against an isolated --profile. Windows stay off-screen or invisible
    /// (alpha 0) and the desktop mouse is never used.
    class Smoke
    {
        readonly LiteApp app;
        readonly Dictionary<string, object> report = new Dictionary<string, object>();
        readonly Dictionary<string, object> checks = new Dictionary<string, object>();
        readonly List<string> errors = new List<string>();
        readonly string phase = Program.Args.ContainsKey("phase") ? Program.Args["phase"] : "write";
        bool finished;

        public Smoke(LiteApp app)
        {
            this.app = app;
            report["version"] = Program.Version;
            report["phase"] = phase;
            report["checks"] = checks;
            report["errors"] = errors;
        }

        public void Error(string message) { errors.Add(message); }

        static void Assert(bool value, string message) { if (!value) throw new Exception(message); }

        public async void Run()
        {
            try
            {
                await Until(() => app.Main.PageReady && app.LastFloat != null, 30000, "page never reported ready");
                report["migrated"] = app.Migrated;
                var probe = await app.Main.Eval("[typeof window.workCheerWindow.minimize, Boolean(document.querySelector('.window-bar .window-close')), typeof require, document.querySelectorAll('[data-resize-edge]').length, Boolean(document.querySelector('.income-value'))].join('|')");
                Assert(probe == "\"function|true|undefined|8|true\"", "page, title bar or bridge not as expected: " + probe);
                checks["pageTitleBarResizeEdgesNoNode"] = true;
                Assert(System.Text.RegularExpressions.Regex.IsMatch(app.LastFloat.Time, @"^(\d{2}:\d{2}:\d{2}|休息日|已下班)$"), "floating feed time: " + app.LastFloat.Time);
                checks["floatingFeedFromPage"] = true;
                if (phase == "write") await Write(); else Read();
            }
            catch (Exception error) { errors.Add(error.Message); }
            Finish();
        }

        async Task Write()
        {
            string expected;
            if (Program.Args.TryGetValue("expect-goal", out expected))
            {
                var goal = await app.Main.Eval("JSON.parse(localStorage.getItem('work-cheer-v1')).settings.goalName");
                Assert(goal == new JavaScriptSerializer().Serialize(expected), "migrated goal name: " + goal);
                checks["migratedFromFullEdition"] = true;
            }
            var shots = Program.Args.ContainsKey("shots") ? Program.Args["shots"] : null;
            var index = 0;
            foreach (var style in Prefs.Styles)
            {
                app.SwitchMode(true, style);
                await Task.Delay(600);
                Assert(!app.Main.Visible && app.Float.Visible && app.Float.CurrentStyle == style, "floating mode " + style);
                Assert(app.Float.Size == app.Float.PixelSize(style), "widget size " + style + " " + app.Float.Size);
                using (var shot = app.Float.Snapshot())
                {
                    Assert(Coverage(shot) > .04, "widget looks empty: " + style);
                    if (shots != null) { Directory.CreateDirectory(shots); shot.Save(Path.Combine(shots, style + ".png"), ImageFormat.Png); }
                }
                var target = new Point(app.WorkArea.X + 60 + index * 40, app.WorkArea.Y + 90);
                app.Float.Location = target;
                app.FloatMoved();
                Assert(app.Prefs.FloatPositions[style] == target, "position not saved " + style);
                index++;
            }
            checks["threeNativeStylesRenderAndRememberPositions"] = true;
            Assert(FloatWidget.DisplayFontsLoaded, "pixel/LCD numeral fonts not embedded");
            checks["displayFontsEmbedded"] = true;
            // 1.12: every widget theme in every style; the page keeps its own look.
            var pageLook = await app.Main.Eval("document.documentElement.dataset.style");
            var followed = app.LastFloat.Style;
            foreach (var theme in Prefs.Themes)
            {
                await app.PickTheme(theme);
                foreach (var style in Prefs.Styles)
                {
                    app.SwitchMode(true, style);
                    await Task.Delay(300);
                    Assert(app.LastFloat.Style == theme && app.Prefs.FloatingTheme == theme && app.Float.Visible && app.Float.CurrentStyle == style, "widget theme " + theme + " " + style + ": " + app.LastFloat.Style);
                    using (var shot = app.Float.Snapshot())
                    {
                        Assert(Coverage(shot) > .04, "widget looks empty: " + theme + " " + style);
                        if (shots != null) shot.Save(Path.Combine(shots, "theme-" + theme + "-" + style + ".png"), ImageFormat.Png);
                    }
                }
            }
            Assert(await app.Main.Eval("document.documentElement.dataset.style") == pageLook, "the widget theme changed the page's look");
            await app.PickTheme("");
            await Task.Delay(300);
            Assert(app.LastFloat.Style == followed && app.Prefs.FloatingTheme == "", "follow main window: " + app.LastFloat.Style);
            checks["widgetThemeIndependentOfMainWindow"] = true;
            // Reload this isolated test profile with split-countdown settings; the real profile is never touched.
            var saved = await app.Main.Eval("localStorage.getItem('work-cheer-v1')");
            var setup = "(() => {const d=JSON.parse(localStorage.getItem('work-cheer-v1'));Object.assign(d.settings,{splitCountdown:true,startTime:'08:30',endTime:'17:00',breakEnabled:true,breakStart:'12:00',breakEnd:'13:00',workdays:[0,1,2,3,4,5,6],useChinaHolidays:false,calendarOverrides:{}});d.records={};localStorage.setItem('work-cheer-v1',JSON.stringify(d));location.reload();})()";
            await app.Main.Eval(setup);await Task.Delay(1200);
            foreach (var style in Prefs.Styles)
            {
                app.SwitchMode(true, style);
                var hours = new[] {11,12,14};var labels = new[] {"距中午下班","距下午上班","距今日下班"};var times = new[] {"00:30:00","00:30:00","03:00:00"};
                for(var phaseIndex=0;phaseIndex<hours.Length;phaseIndex++)
                {
                    var minutes=phaseIndex==2?0:30;
                    await app.Main.Eval("(() => {const D=window.__middayRealDate||(window.__middayRealDate=Date),at=new D(2026,10,4,"+hours[phaseIndex]+","+minutes+",0).getTime();window.Date=class extends D{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};})()");
                    await Until(()=>app.LastFloat.Label==labels[phaseIndex]&&app.LastFloat.Time==times[phaseIndex],5000,"midday phase not mirrored "+style+" "+labels[phaseIndex]);
                    using(var shot=app.Float.Snapshot())Assert(Coverage(shot)>.04,"empty midday widget");
                }
            }
            checks["middayPhasesInEveryStyle"] = true;
            await app.Main.Eval("localStorage.setItem('work-cheer-v1',"+saved+");location.reload();");await Task.Delay(1200);
            app.SwitchMode(false, null);
            await Task.Delay(300);
            Assert(app.Main.Visible && !app.Float.Visible, "did not return to the full window");
            checks["returnToFullWindow"] = true;
            await app.PickTheme("lcd");
            app.SwitchMode(true, "ring");
            await Task.Delay(300);
        }

        void Read()
        {
            Assert(app.Float.Visible && app.Float.CurrentStyle == "ring", "restart did not restore the ring widget");
            foreach (var style in Prefs.Styles) Assert(app.Prefs.FloatPositions.ContainsKey(style), "position lost for " + style);
            Assert(app.Float.Location == app.Prefs.FloatPositions["ring"], "ring position not restored");
            checks["styleAndPositionsPersistAcrossRestart"] = true;
            Assert(app.Prefs.FloatingTheme == "lcd" && app.LastFloat.Style == "lcd", "widget theme not restored: " + app.LastFloat.Style);
            checks["widgetThemePersistsAcrossRestart"] = true;
        }

        public void Finish()
        {
            if (finished) return;
            finished = true;
            report["ok"] = errors.Count == 0;
            try { File.WriteAllText(Program.Args["output"], new JavaScriptSerializer().Serialize(report)); } catch (Exception) { }
            app.Quit(errors.Count == 0 ? 0 : 1);
        }

        static double Coverage(Bitmap bitmap)
        {
            int painted = 0, total = 0;
            for (var y = 0; y < bitmap.Height; y += 3)
                for (var x = 0; x < bitmap.Width; x += 3, total++)
                    if (bitmap.GetPixel(x, y).A > 24) painted++;
            return total == 0 ? 0 : (double)painted / total;
        }

        static async Task Until(Func<bool> condition, int timeout, string message)
        {
            var clock = Stopwatch.StartNew();
            while (!condition())
            {
                if (clock.ElapsedMilliseconds > timeout) throw new Exception(message);
                await Task.Delay(100);
            }
        }
    }
}
