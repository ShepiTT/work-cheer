# 上班鼓励器 Windows 轻量版（WebView2）

- 2026-11-06 用户要求完整版（Electron，约 100 MB）和轻量版都提供，让使用者自己选。轻量版用 Windows 自带的 Edge WebView2 运行同一份离线网页，单个 EXE 约 1.7 MB。
- 结构：C#（.NET Framework 4.8 自带的 csc，C# 5 语法：不要用 `?.`、`$""`、`nameof` 等）+ WebView2 SDK 1.0.4314.35（`../third_party`）。SDK 的 DLL 和页面都嵌在 EXE 里；运行时 WebView2Loader.dll 与 index.html 解压到 `%LOCALAPPDATA%\WorkCheerLite\runtime-<版本>`。
- 页面就是 `../../outputs/上班鼓励器.html`（`tools/prepare.cjs` 做桌面文案替换）。`src/bridge.js` 在页面前注入：提供与完整版 `window-preload.cjs` 相同的 `window.workCheerWindow`，加 8 条窗口边缘缩放手柄，并把今日已赚、倒计时、进度和当前主题颜色发给原生悬浮窗。标题栏拖动靠 WebView2 的 `IsNonClientRegionSupportEnabled`（CSS app-region 原样生效）。
- 悬浮窗由 C#/GDI+ 自绘在逐像素透明的分层窗口里（`src/FloatWidget.cs`），三款版式与配色规则对齐完整版的 `floating.css`；改其中一边的悬浮窗设计时同步另一边。整窗作为标题区，用系统拖动；右键菜单、Esc 回完整窗口。
- 1.11 起像素、赛博朋克、千禧、黏土、液晶五套主题的悬浮窗各有自己的画法（`src/FloatThemes.cs`，坐标与完整版 `floating.css` 同为 CSS 像素）。所需的额外颜色（ink、b1–b4、lcd 等）由 `bridge.js` 先画进 1 像素再读回成 sRGB `rgba()` 发来，C# 不必解析 oklab；像素、液晶数字字体以 TTF 嵌入（`fonts/`，由 `../work-cheer/scripts/make-display-fonts.py` 生成，`build.ps1` 打进资源），冒烟检查含“字体已嵌入”。
- 1.12（用户 2026-11-14 选“悬浮窗外观单独选”）：右键/托盘/⋯ 菜单多一项“悬浮窗主题”（跟随主窗口 + 八套），存在 preferences.json 的 `floatingTheme`（"" = 跟随；首次启动也从完整版偏好导入）。原生端在 `ready` 后把它发给 `bridge.js`；bridge 收到后才开始上报（避免先闪主窗口主题），并在一个带 `data-style/color/scheme` 的隐藏探针上取色——主题色值是同一元素上的属性选择器，所以页面本身的外观不变。菜单切换走 `window.__workCheerFloatTheme(id)`（立即返回新数据，先重绘再显示）。颜色与浅/深色仍跟随主窗口。完整版同名功能见 `../work-cheer-desktop/AGENTS.md`，两边同步改。
- 数据：`%APPDATA%\WorkCheerLite`（WebView2 资料与 preferences.json，位置为物理像素）。第一次启动若还没有自己的数据，会从完整版 `%APPDATA%\WorkCheer` 复制 localStorage（同为 Chromium 的 file:// 存储）和样式/透明度等偏好，之后两边独立。
- 构建：`powershell -File build.ps1`；检查：`node smoke-lite.cjs`（先用完整版的 Electron 生成一份带“迁移测试”目标的数据，再用独立测试目录跑两次；窗口不可见、不动鼠标）。真实鼠标操作需用户试用。
- 只暴露固定窗口动作，只允许导航到本地页面，DevTools 默认关闭（`--devtools` 仅调试用）。
