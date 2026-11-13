# 第三方许可说明

项目根目录的 MIT 许可证适用于本项目代码。以下材料及运行时保留各自的版权与许可，不以项目许可证替代。

| 材料 | 用途 | 保留的许可 |
| --- | --- | --- |
| WizzenH/xindong | 月薪日历、主题色与桌面交互参考 | [MIT 全文](work/work-cheer/public/licenses/xindong-MIT.txt) |
| Noto Sans SC | 界面内嵌字体、励字印章字形 | [SIL OFL 1.1 全文](work/work-cheer/public/fonts/OFL.txt) |
| React、React DOM、Phosphor | 网页界面与图标 | 构建时收集到 [桌面第三方声明](work/work-cheer-desktop/THIRD_PARTY_NOTICES.txt) |
| Electron、Chromium | 桌面运行时 | 由 Electron 提供，Windows 发布 ZIP 保留 LICENSE.electron.txt 与 LICENSES.chromium.html |

字体是可变字体子集，源码包含其 OFL 许可；更新子集或修改字体时继续遵守相应条件。字体和图标的许可证不会变成本项目对上游作者的专门授权书，也不代表上游作者为本项目背书。

离线网页打包脚本把字体及参考项目许可写入 HTML，同时复制可读许可文件。Windows 的 prepare 脚本收集第三方声明；重新分发软件时保留发布包中的这些文件。

轻量版内含 Microsoft WebView2 SDK 1.0.4314.35 组件，其 [LICENSE](work/third_party/microsoft.web.webview2.1.0.4314.35/extracted/LICENSE.txt) 与 [NOTICE](work/third_party/microsoft.web.webview2.1.0.4314.35/extracted/NOTICE.txt) 随源码及发布包保留。

1.10.0 的 Work Cheer Pixel 和 Work Cheer LCD 数字字体由本项目从字形代码自绘，采用项目 MIT 许可；对应生成脚本为 `work/work-cheer/scripts/make-display-fonts.py`。
