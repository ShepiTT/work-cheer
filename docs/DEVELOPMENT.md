# 开发说明

当前基线为 1.13.0，包含 React 网页、Electron 完整版与 WebView2 轻量版。两个应用保留独立的锁文件，根目录 package.json 仅提供便捷命令，不会发布到 npm。

## 安装与构建

Node.js 22+、npm；桌面打包在 Windows x64 执行。首次安装依赖和下载 Electron 运行时需要网络，构建好的软件可离线运行。

```bash
npm run setup
npm run dev
```

只开发网页时可运行 `npm --prefix work/work-cheer ci`，无需下载 Electron。

| 命令 | 结果 |
| --- | --- |
| `npm test` | 先构建网页及 Sites 适配文件，再执行两组 Node 检查 |
| `npm run build:web` | `work/work-cheer/dist/client`、`dist/server`、`dist/.openai` |
| `npm run build:offline` | 根目录 `outputs/上班鼓励器.html` 和带授权的 `outputs/上班鼓励器` 文件夹 |
| `npm run build:desktop` | 先生成离线网页，再生成 `work/work-cheer-desktop/dist/上班鼓励器-1.13.0-Windows-x64.exe` |
| `npm run smoke:desktop` | 检查最终便携包，输出桌面工程内 `smoke-portable-*.json` |

桌面 `prepare.cjs` 读取 `../../outputs/上班鼓励器.html`，所以不能跳过离线输入生成，也不要把桌面目录单独挪走。生成的 renderer.html、图标和 dist 不进入 Git。仅改浮窗时可复用离线输入，再到桌面工程运行 `npm run build`。

`.openai/hosting.json`、worker 和 prepare-sites-build 是原网站托管的适配资料；本仓库不携带托管账号授权。不要把本地 build 成功当作网站已更新。

## 主要修改入口

- `work/work-cheer/src/App.jsx`：主界面、时钟、记录和自绘 Windows 标题栏。
- `src/Settings.jsx`：工资、作息、日历和外观设置。
- `src/calculator.js`：工时与收入规则；日历优先级为手动 > 官方 > 每周规律。
- `src/holidays.js`：已内置的官方年份与日期；当前为 2026，不推测未内置年份。
- `src/themes.js` / `themes.css`：八套主题（玻璃、小组件、纸墨、像素、赛博朋克、千禧、黏土、液晶）× 八种颜色 × 外观，包含旧设置迁移。
- 桌面 `main.cjs`：窗口、托盘、模式切换、菜单、边界和受限 IPC。
- 桌面 `floating-preload.cjs`：可信 pointer 输入及拖动捕获，不向网页暴露通用 IPC。
- 桌面 `window-preload.cjs`：只向完整界面开放固定的窗口动作。
- 桌面 `floating-renderer.cjs` / `floating.css`：三款浮窗，从仍在运行的完整卡片读取收入、倒计时和进度。

浮窗依赖 DOM hooks：`.income-value`（纯数字）、`.countdown > span`（三个时间值）、`.status.<state>`、首个 `[role="progressbar"]` 和 `.settings-button`。修改主界面结构时同时检查这些接口。

## 数据与测试隔离

浏览器和桌面渲染页的逻辑存储 key 均为 `work-cheer-v1`：

```json
{
  "version": 1,
  "settings": { "salaryMode": "daily", "dailySalary": 120 },
  "records": {
    "2026-11-05": { "excludedMs": 0, "pausedAt": null, "resetAt": null }
  }
}
```

这里是结构示例，不是完整设置；缺省字段会按计算器默认值合并。外观含 `theme`、`themeColor`、`appearance`，旧配色迁移通过 `normalizeLook` 完成。单日覆盖键为 YYYY-MM-DD，布尔值 true 上班、false 休息。

真实 Windows 数据在 `%APPDATA%/WorkCheer`，原生 `desktop-preferences.json` 保存当前模式、样式、透明度、各款位置和完整窗口状态。测试不能清空或覆盖它。

`smoke-runner.cjs` 创建独立的绝对路径 profile，用最终 EXE 启动两次：不同的便携解压目录、相同的测试资料目录。检查窗口安全开关、三款样式、收入来源、拖动输入与保存、右键/托盘、Esc/设置、边界找回、完整窗口和重启持久化。测试只操作自己的测试进程。

自动注入输入不等于对所有显示器、驱动和真实鼠标操作的人工验收。此项目已记录用户确认原有拖动可用；后续改动仍应保留该链路，并让用户验证实际交互。

## 外观与字体

`qa.html` 用固定时间与内存存储隔离渲染，可带参数：

```text
/qa.html?theme=glass&color=blue&appearance=light&desktop=1
/qa.html?theme=widgets&color=green&appearance=dark
/qa.html?theme=zhimo&color=red&appearance=light
/qa-themes.html?color=blue
```

这些入口只供本地 Vite 开发预览，不作为线上生产入口。截图必须标注演示数据；不要填入真实工资或把生成的设计图说成实际软件截图。

仓库附有可直接使用的 OFL 字体子集及 seal.svg。只有新增界面字符或重做字形时才需要 Python、fonttools、brotli 和原始 Noto Sans SC 可变字体：

```bash
python work/work-cheer/scripts/subset-font.py /path/to/NotoSansSC-VF.ttf
python work/work-cheer-desktop/make-seal-svg.py /path/to/NotoSansSC-VF.ttf
```

不要删除 OFL 或参考项目 MIT 声明。页面主题 token 需要可读的按钮和文字对比度。

## 发布

版本应同时检查根 package.json、桌面 package.json 及锁文件、main.cjs 的 VERSION、smoke-runner.cjs 的目标 EXE 名称。网页 package.json 的 0.0.0 是既有内部包版本，不是软件发布号。

先构建并检查最终 EXE，再生成 Windows ZIP 和离线网页 ZIP，保留许可与校验值，最后创建 GitHub Release。不要向 Git 提交 EXE、依赖目录、测试 profile 或个人资料。只改桌面时，不自动发布原 Sites 网站。

用户本机的交付副本不属于公共仓库内容；更新本机入口和清理旧文件需要遵循当前用户指示。贡献者请先阅读各工程的 AGENTS.md，并按自己机器的目录调整路径。


## 轻量版构建

Windows x64，需要 .NET Framework 4.8、Node.js 和系统 Edge WebView2。源码内附 WebView2 SDK 1.0.4314.35 的构建组件和许可。先在仓库根目录执行 `npm run setup`、`npm run build:offline`，再运行：

```powershell
powershell -File work/work-cheer-lite/build.ps1
node work/work-cheer-lite/smoke-lite.cjs
```

轻量版使用 `%APPDATA%/WorkCheerLite`，完整版使用 `%APPDATA%/WorkCheer`。自动检查使用独立测试数据；人工鼠标操作验收仍待确认。1.13.0 完整版 EXE 102709011 字节，轻量版 EXE 1835008 字节；这些数字不包括系统共享运行时占用。


## 1.10.0 新主题

新增样式集中在 `work/work-cheer/src/styles-more.css`；颜色 token 仍在 `themes.css`。像素、液晶数字字体由 `scripts/make-display-fonts.py` 自绘（需 fontTools、brotli），生成的 WOFF2 已随源码提供，常规构建无需重新生成。主题预览还可使用 `/qa-states.html?theme=pixel&width=375`，或 `/qa-themes.html?styles=pixel,cyber,y2k,clay,lcd&appearance=dark`。


## 1.12.0 独立悬浮窗主题

原生偏好 `floatingTheme`：空字符串表示跟随主窗口，否则为八套主题之一（glass/widgets/zhimo/pixel/cyber/y2k/clay/lcd）。完整版 `mountFloating(style, theme)` 用根节点主题属性和 MutationObserver 保持独立外观；轻量版在隐藏探针上读取所选主题的 sRGB token，主页面本身的外观不变。颜色及浅深外观仍跟随主窗口。

五套新增主题的完整版画法在 `floating.css` / `floating-renderer.cjs`；轻量版在 `FloatThemes.cs`，两边同时维护。轻量版所需像素、液晶 TTF 数字字体在 `work/work-cheer-lite/fonts/`，构建时嵌入 EXE；由网页的 `scripts/make-display-fonts.py` 自绘生成。检查覆盖 8 主题 × 3 样式、跟随主窗口及重启恢复，人工操作确认单独记录。

## 1.13.0 午间分段倒计时

`splitCountdown` 默认 false，保持旧作息兼容；启用时用 `breakStart`（中午下班）和 `breakEnd`（下午上班）切换目标。`breakEnabled` 仍只控制是否扣除午休工时，两者独立。原有 `remainingMs` 保留全天结束语义，收入与进度算法不变。

`calculator.js` 统一输出 `countdownMs`、`countdownPhase`、`countdownLabel`，主页面用 `.countdown[data-label][data-phase]` 暴露目标。完整版观察时间及标签变化，轻量版 bridge 直接发送标签；不要在悬浮窗里另写阶段计算。

本版新增边界、自定义时间、计薪独立、暂停/重置、节假日/补班与旧设置兼容检查。`qa-states.html` 提供 `midday-morning`、`midday-break`、`midday-afternoon` 固定状态。两个桌面版的隔离 smoke 均覆盖三款样式的午间切换。
