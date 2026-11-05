# 开发说明

当前基线为 1.8.0，包含 React 网页与 Electron Windows 便携版。两个应用保留独立的锁文件，根目录 package.json 仅提供便捷命令，不会发布到 npm。

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
| `npm run build:desktop` | 先生成离线网页，再生成 `work/work-cheer-desktop/dist/上班鼓励器-1.8.0-Windows-x64.exe` |
| `npm run smoke:desktop` | 检查最终便携包，输出桌面工程内 `smoke-portable-*.json` |

桌面 `prepare.cjs` 读取 `../../outputs/上班鼓励器.html`，所以不能跳过离线输入生成，也不要把桌面目录单独挪走。生成的 renderer.html、图标和 dist 不进入 Git。仅改浮窗时可复用离线输入，再到桌面工程运行 `npm run build`。

`.openai/hosting.json`、worker 和 prepare-sites-build 是原网站托管的适配资料；本仓库不携带托管账号授权。不要把本地 build 成功当作网站已更新。

## 主要修改入口

- `work/work-cheer/src/App.jsx`：主界面、时钟、记录和自绘 Windows 标题栏。
- `src/Settings.jsx`：工资、作息、日历和外观设置。
- `src/calculator.js`：工时与收入规则；日历优先级为手动 > 官方 > 每周规律。
- `src/holidays.js`：已内置的官方年份与日期；当前为 2026，不推测未内置年份。
- `src/themes.js` / `themes.css`：玻璃、小组件、纸墨 × 八种颜色 × 外观，包含旧设置迁移。
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
