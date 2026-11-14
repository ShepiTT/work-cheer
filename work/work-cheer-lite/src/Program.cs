using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("上班鼓励器 轻量版")]
[assembly: AssemblyProduct("上班鼓励器")]
[assembly: AssemblyDescription("实时收入估算与下班倒计时（WebView2 轻量版）")]
[assembly: AssemblyCopyright("Copyright © 2026 Work Cheer")]
[assembly: AssemblyVersion("1.12.0.0")]
[assembly: AssemblyFileVersion("1.12.0.0")]

namespace WorkCheerLite
{
    static class Program
    {
        public const string Version = "1.12.0";
        public static readonly Dictionary<string, string> Args = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, Assembly> embedded = new Dictionary<string, Assembly>();

        public static bool Smoke { get { return Args.ContainsKey("smoke"); } }

        [STAThread]
        static int Main(string[] argv)
        {
            foreach (var arg in argv)
            {
                if (!arg.StartsWith("--")) continue;
                var split = arg.IndexOf('=');
                if (split > 0) Args[arg.Substring(2, split - 2)] = arg.Substring(split + 1);
                else Args[arg.Substring(2)] = "";
            }
            AppDomain.CurrentDomain.AssemblyResolve += ResolveEmbeddedAssembly;
            try { NativeMethods.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { }
            return Run();
        }

        // Kept out of Main so nothing from the WebView2 assemblies is touched before the resolver is in place.
        [MethodImpl(MethodImplOptions.NoInlining)]
        static int Run()
        {
            bool first;
            var name = Smoke ? "WorkCheerLite.Smoke." + Guid.NewGuid().ToString("N") : "WorkCheerLite.SingleInstance";
            using (var mutex = new Mutex(true, name, out first))
            {
                if (!first)
                {
                    NativeMethods.PostMessage(new IntPtr(0xffff), NativeMethods.ShowMessage, IntPtr.Zero, IntPtr.Zero);
                    return 0;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                var app = new LiteApp();
                Application.Run(app);
                return app.ExitCode;
            }
        }

        // The WebView2 SDK assemblies travel inside this EXE so the app stays a single file.
        static Assembly ResolveEmbeddedAssembly(object sender, ResolveEventArgs e)
        {
            var file = new AssemblyName(e.Name).Name + ".dll";
            lock (embedded)
            {
                Assembly assembly;
                if (embedded.TryGetValue(file, out assembly)) return assembly;
                using (var stream = typeof(Program).Assembly.GetManifestResourceStream(file))
                {
                    if (stream == null) return null;
                    using (var copy = new MemoryStream())
                    {
                        stream.CopyTo(copy);
                        assembly = Assembly.Load(copy.ToArray());
                    }
                }
                embedded[file] = assembly;
                return assembly;
            }
        }
    }
}
