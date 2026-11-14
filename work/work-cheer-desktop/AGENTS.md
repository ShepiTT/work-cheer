# 上班鼓励器 Windows 版

- 用户要求真实可运行的软件，并实际启动、验证最终便携 EXE。
- 用户喜欢仅显示「今日已赚」和「下班倒计时」的桌面悬浮窗；置顶、可拖动、退出后记住模式和位置。
- 用户已选择三款设计全部加入：极简胶囊、透明悬字、倒计时圆环。通过原生右键/托盘切换，分别记住位置；金额两位小数，倒计时为 HH:MM:SS。
- 2026-11-05 用户要求按设计者审美重做界面和主题，并明确“主题应是不同样式、一个主题可以有不同颜色、参考苹果设计”（1.6.0：玻璃/小组件/纸墨 × 八种颜色 × 浅色/深色/自动，见网页 AGENTS.md）。1.7.0 起三款悬浮窗也按苹果风格：胶囊 360×64 是灵动岛式黑色实时活动（左侧进度小圆环，右侧倒计时用强调色）；透明悬字是锁屏式粗体白字加白色进度条；圆环是 Apple Watch 式活动圆环（黑色表盘、渐变圆环、带阴影的圆头）。1.8.0 起悬浮窗顺应主题：底色、文字、强调色和浅色/深色都取自当前主题的 token（玻璃为近不透明的磨砂白/黑加一点主题色；透明悬字浅色外观用墨色字加白色光晕，深色外观用白字）。design-references 里是 1.4 旧稿，不再作为外观基准。
- 2026-11-13 用户：“悬浮窗的样式也要改呀”——1.11.0 起 1.10 新增的五套主题（像素、赛博朋克、千禧、黏土、液晶）连悬浮窗也换成各自的样子，三款样式不变（胶囊、透明悬字、圆环；千禧的圆环是带标题栏和 3D 饼图的小窗口）。布局在 `floating.css` 末尾，进度指示在 `floating-renderer.cjs` 的画布里按主题绘制；轻量版 `../work-cheer-lite/src/FloatThemes.cs` 原生画同样的设计，改一边要同步另一边。冒烟检查的约束（两个数据块、文字不出窗口、透明悬字无底板、圆环画布有进度）新设计全部满足。
- 应用图标与网页页眉同为朱砂印章「励」：assets/seal.svg 由 make-seal-svg.py 从 Noto Sans SC（OFL）生成，prepare.cjs 再转成 icon.png/icon.ico。
- 右键数据区域或 Esc 返回完整窗口；设置入口先恢复完整窗口。
- 1.8.0 起完整窗口无边框（frame:false）：用户要求去掉系统标题栏和“窗口/帮助”菜单栏。页面自绘标题栏（右上角磨砂胶囊：进入悬浮窗、⋯ 菜单、最小化、最大化、关闭），顶部和卡片外空白处可拖动窗口。window-preload.cjs 只暴露这几个固定动作，main.cjs 校验发送方；原菜单项都在 ⋯ 弹出菜单里，快捷键保留。
- 普通窗口的尺寸、最大化状态和置顶偏好应独立保留。屏幕变化后窗口必须仍可找回。
- 保持 %APPDATA%/WorkCheer 与 work-cheer-v1 数据兼容，默认不设置开机自启、不改变关闭行为。
- 测试只能使用独立绝对路径的测试 profile，不能终止现有用户实例或触碰真实用户数据。
- 用户要求真实鼠标操作由自己验证；此类修复完成代码、隔离自动检查和打包更新后交付，不再代操作桌面鼠标。自动检查不等同于用户验收。
- 2026-11-05 用户确认悬浮窗真实鼠标拖动已可用（1.4.1 起的隔离 preload + 受限 IPC 方案）；改动悬浮窗时不要破坏这条拖动链路。
- 1.12（用户 2026-11-14 选“悬浮窗外观单独选”，而不是新增形状）：菜单“悬浮窗主题”（跟随主窗口 + 八套），偏好 `floatingTheme`（"" = 跟随）。`mountFloating(style, theme)` 把主题写到悬浮窗页面的 `<html data-style>` 并用 MutationObserver 守住（页面在系统深浅色变化时会重设主窗口外观）；颜色与浅/深色仍跟随主窗口。切换主题像切样式一样重建窗口。冒烟检查覆盖 8 主题 × 3 样式、跟随主窗口、重启后保留。
- 仅桌面工程有改动时，不发布网站或修改网页工程。
- 用户要求交付目录只保留最新版本：发布新版后把旧版 EXE、旧说明和旧预览移到回收站（不永久删除），不再并排保留。

- 1.13 (user confirmed 2026-11-14): optional splitCountdown uses breakStart (中午下班) and breakEnd (下午上班) to count to noon, afternoon start, then day end. Default false for old-settings compatibility; independent of breakEnabled (unpaid lunch). Existing remainingMs and salary calculations stay unchanged; new countdownMs/countdownPhase/countdownLabel drive the UI, and .countdown[data-label] is mirrored by both desktop widget feeds. Never duplicate phase arithmetic in the widgets.
