# 一条命令运行真实 Windows Demo

这条路径已在真实无影 Windows 云电脑上验证。即使 MCP 只提供 `aiengine__shell`、`aiengine__write_file`、`aiengine__read_file`，也能运行浏览器和桌面演示。

```text
本地 Demo → 无影 MCP → Windows PowerShell
                         ├─ Chrome / Edge：读取页面、输入、点击、校验
                         └─ 记事本：定位控件、键盘输入、读取文本校验
                      ← 实际截图与结构化结果
```

这里的操作通过 MCP 的 shell 能力实现，并非端点新增了 browser_click 等专用工具。演示执行的是可审查的固定脚本，不是自主规划 Agent；ChatGPT 自定义连接仍是独立接入步骤。

## 运行

本地安装 Node.js 22.9+，执行 `npm ci` 并按 README 配置 `.env`。目标云电脑需已登录、解锁，并具备 64 位 Windows PowerShell、Chrome 或 Edge、Windows 记事本；本次实际验证为新版带标签页的记事本。其他系统版本需要单独验证。

```bash
npm run demo
```

也可分别运行：

```bash
npm run demo -- browser
npm run demo -- desktop
```

该命令显式允许三个上述工具，允许范围只作用于此次 Demo 进程，不修改日常桥接的 `observe` 配置。确保运行期间没有其他人或 Agent 同时操作这台桌面。

## Browser Use 做什么

1. 在云电脑创建独立演示目录与浏览器配置。
2. 打开项目自带的测试页面。
3. 通过 Chrome DevTools Protocol 读取控件状态、输入文字、发送鼠标点击。
4. 检查页面实际显示的结果，保存浏览器页面截图。
5. 结束本次独立浏览器进程；不复用日常浏览器配置。

测试页面是用于验证操作的目标页面。浏览器进程、点击、输入和截图均在真实云电脑发生；不是预录动画或假桌面。它验证操作链路，不代表任意第三方网站任务都已通过。

## Computer Use 做什么

1. 在独立目录创建空白演示文件，并在真实记事本中打开。
2. 按唯一文件名定位窗口，通过 Windows UI Automation 找到编辑控件。
3. 确认文档为空、窗口和控件获得焦点，再通过 Windows `SendInput` 发送 Unicode 键盘事件。
4. 等待应用处理输入，读取实际编辑器文本并逐字校验。
5. 保存窗口截图，留下演示文档供查看。

不是直接把结果写入文件后冒充键盘输入。初始文件为空，结果来自 Windows 输入事件。脚本不发送保存命令；新版记事本自身可能恢复或暂存会话内容。

## 查看结果

终端显示 `browser: VERIFIED` / `desktop: VERIFIED` 后，打开打印目录中的 `report.html`：

```text
.artifacts/run-时间戳/
  report.html       可直接打开的截图报告
  report.json       每一步验证结果
  browser.png       实际浏览器页面截图
  desktop.png       实际记事本窗口截图
```

失败时命令退出码非零，报告标记 `INCOMPLETE`。远端错误保存在本地 `error.json`；超时不自动重发输入。部分截图读取失败时，本地保留原始 MCP 响应便于排查。

云电脑演示文件位于 `C:\Users\Public\WuyingMcpDemo\run-时间戳`。查看完后可关闭对应演示标签页、删除该次演示目录；不要删除不属于本次运行的内容。该目录不写入 MCP 凭据。截图和执行结果在本地 Git 忽略目录内，不提交公共仓库。

PowerShell 的 `-ExecutionPolicy Bypass` 仅用于当前脚本进程，不修改系统执行策略。浏览器调试端口限制在回环地址，使用独立配置并在完成后关闭。本例聚焦单用户演示，尚未实现多租户调度、并发锁与通用 Agent 工具封装。

参考：[Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)、[Windows 前台窗口 API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow)。
