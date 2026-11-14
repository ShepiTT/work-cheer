using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Web.Script.Serialization;

namespace WorkCheerLite
{
    /// Window preferences (preferences.json). Positions are physical pixels, as the window manager reports them.
    class Prefs
    {
        public static readonly int[] OpacityChoices = { 100, 90, 80, 65 };
        public static readonly string[] Styles = { "capsule", "transparent", "ring" };
        /// 1.12: the floating widget's own 主题; "" follows the main window. Same ids as the page's STYLES.
        public static readonly string[] Themes = { "glass", "widgets", "zhimo", "pixel", "cyber", "y2k", "clay", "lcd" };
        public static readonly string[] ThemeNames = { "玻璃", "小组件", "纸墨", "像素", "赛博朋克", "千禧", "黏土", "液晶" };

        public int Opacity = 100;
        public bool AlwaysOnTop, CloseToTray, Floating, FullMaximized;
        public string FloatingStyle = "capsule", FloatingTheme = "";
        public Rectangle FullBounds = Rectangle.Empty;
        public readonly Dictionary<string, Point> FloatPositions = new Dictionary<string, Point>();
        readonly string path;

        public Prefs(string path)
        {
            this.path = path;
            var saved = Read(path);
            if (saved == null) return;
            ApplyCommon(saved);
            Floating = Flag(saved, "floating");
            FullMaximized = Flag(saved, "fullMaximized");
            FullBounds = ReadRect(saved, "fullBounds");
            object value;
            if (saved.TryGetValue("floatPositions", out value) && value is Dictionary<string, object>)
            {
                foreach (var entry in (Dictionary<string, object>)value)
                {
                    var point = entry.Value as Dictionary<string, object>;
                    if (point != null && Array.IndexOf(Styles, entry.Key) >= 0 && point.ContainsKey("x") && point.ContainsKey("y"))
                        FloatPositions[entry.Key] = new Point(Convert.ToInt32(point["x"]), Convert.ToInt32(point["y"]));
                }
            }
        }

        /// First launch only: carry over the full edition's choices (positions differ in units, so they are left out).
        public void ImportFullEdition(string fullEditionPreferences)
        {
            var saved = Read(fullEditionPreferences);
            if (saved != null) ApplyCommon(saved);
        }

        void ApplyCommon(Dictionary<string, object> saved)
        {
            object value;
            if (saved.TryGetValue("opacity", out value) && value is int && Array.IndexOf(OpacityChoices, (int)value) >= 0) Opacity = (int)value;
            AlwaysOnTop = Flag(saved, "alwaysOnTop");
            CloseToTray = Flag(saved, "closeToTray");
            if (saved.TryGetValue("floatingStyle", out value) && value is string && Array.IndexOf(Styles, (string)value) >= 0) FloatingStyle = (string)value;
            if (saved.TryGetValue("floatingTheme", out value) && value is string && Array.IndexOf(Themes, (string)value) >= 0) FloatingTheme = (string)value;
        }

        public void Save()
        {
            var positions = new Dictionary<string, object>();
            foreach (var entry in FloatPositions) positions[entry.Key] = new Dictionary<string, object> { { "x", entry.Value.X }, { "y", entry.Value.Y } };
            var data = new Dictionary<string, object>
            {
                { "opacity", Opacity }, { "alwaysOnTop", AlwaysOnTop }, { "closeToTray", CloseToTray }, { "floating", Floating },
                { "floatingStyle", FloatingStyle }, { "floatingTheme", FloatingTheme }, { "fullMaximized", FullMaximized }, { "floatPositions", positions },
            };
            if (!FullBounds.IsEmpty) data["fullBounds"] = new Dictionary<string, object> { { "x", FullBounds.X }, { "y", FullBounds.Y }, { "width", FullBounds.Width }, { "height", FullBounds.Height } };
            var temp = path + ".tmp";
            File.WriteAllText(temp, new JavaScriptSerializer().Serialize(data));
            if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
        }

        static Dictionary<string, object> Read(string file)
        {
            try { return File.Exists(file) ? new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(file)) : null; }
            catch (Exception) { return null; }
        }

        static bool Flag(Dictionary<string, object> data, string key)
        {
            object value;
            return data.TryGetValue(key, out value) && value is bool && (bool)value;
        }

        static Rectangle ReadRect(Dictionary<string, object> data, string key)
        {
            object value;
            var rect = data.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
            if (rect == null) return Rectangle.Empty;
            try
            {
                var bounds = new Rectangle(Convert.ToInt32(rect["x"]), Convert.ToInt32(rect["y"]), Convert.ToInt32(rect["width"]), Convert.ToInt32(rect["height"]));
                return bounds.Width > 0 && bounds.Height > 0 ? bounds : Rectangle.Empty;
            }
            catch (Exception) { return Rectangle.Empty; }
        }
    }
}
