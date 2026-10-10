# Power BI 实测记录：从环境准备到可编辑成果

[仓库首页](../README.md) · [运行与下载](../examples/powerbi-sales/README.md) · [MCP 优化建议](mcp-improvements.md)

测试日期：2026-10-10（北京时间）。本记录根据本次实际操作、工具返回和已保留的应用截图整理，按执行顺序描述；不是完整逐调用日志，也不包含未经记录的耗时或成功率估算。

## 结论与边界

在真实无影 Windows 云电脑中完成了 Power BI Desktop 安装、模拟 Excel 导入、原生报表配置、区域筛选、PBIX 保存与重新打开。销售额与独立计算的预期值一致。

**本次是 Agent 辅助执行、观察和修正的实测。** 仓库的 `npm run demo:powerbi` 复用最终报表，只负责文件上传、哈希检查和启动请求；它不会自动重演安装、导入、图表设计与筛选验收全过程。

尚未验证：App 内 SDK 工作区嵌入、ChatGPT 账号侧连接、用户与 Agent 控制权交接、多租户隔离、Power BI 在线发布、定时刷新，以及 PBIP 在另一台干净环境中的首次刷新。

## 环境与实际调用链

| 项目 | 本次环境 |
| --- | --- |
| 目标机器 | 无影 Windows 11 Pro，系统识别约 15.5 GB 内存；安装前约 70 GB 可用磁盘 |
| 目标应用 | Power BI Desktop 2.158.1304.0，微软官方下载，安装前检查数字签名有效 |
| MCP 传输 | Streamable HTTP；当前端点发现 8 个带 `aiengine__` 前缀的工具 |
| 主执行工具 | `aiengine__shell`、`aiengine__write_file`、`aiengine__read_file` |
| 观察工具 | 尝试 `aiengine__screenshot`；完整桌面证据改由启用 DPI awareness 的 Windows 截图获取 |
| 数据 | 240 条模拟订单，2025 年 12 个月 × 4 区域 × 5 产品；无客户数据 |
| 云端演示目录 | `C:\Users\Public\WuyingMcpDemo\powerbi-sales` |

```text
Agent / 本地 MCP 客户端
  → 无影 MCP
    → shell：PowerShell、Windows UI Automation、Win32
    → 文件工具：Excel、PBIR/TMDL、PBIX、PNG
      → 真实 Power BI Desktop：导入、计算、渲染、筛选、保存
  ← 工具结果、文件与真实截图
```

当前端点没有暴露独立的浏览器点击、鼠标点击或键盘输入工具。本次通过 shell 调用系统接口完成这些操作，不能据此宣称所有无影 MCP 版本都具备相同的专用工具。

## 测试经过

| 阶段 | 实际操作 | 观察与处理 | 阶段结果 |
| --- | --- | --- | --- |
| 1. 环境检查 | 检查系统、内存、磁盘及 Power BI 安装状态 | 机器尚未安装 Power BI | 确认使用 Windows 应用案例 |
| 2. 安装应用 | 下载微软官方安装包，验证签名，执行静默安装 | 安装调用超时；继续检查二进制文件、版本与进程，没有将超时当作安装失败 | 确认安装完成，并成功启动 2.158.1304.0 |
| 3. 准备数据 | 生成 Excel 表 `SalesData`，计算独立预期结果，通过文件工具传入 | 金额为模拟订单的实际计算值 | 形成可核验的数据基准 |
| 4. 导入 Excel | 在 Power BI 界面选择工作簿、勾选 `SalesData` 并加载 | 应用识别到表和列；Month 自动识别为日期 | 真实应用中完成数据导入 |
| 5. 修正观察与输入 | 检查截图与窗口，尝试填写保存文件名 | 默认截图只覆盖部分桌面；SendKeys 输入未生效；UI Automation 存在隐藏或重复控件 | 改用 DPI-aware 全屏截图及 Win32 原生编辑控件写入，观察确认后继续 |
| 6. 保存原生项目 | 在“另存为”中选择 PBIP | 检查实际生成的 Report、SemanticModel 和 PBIP 文件 | 获得 Power BI 自身创建的数据模型与项目结构 |
| 7. 配置看板 | 关闭已保存项目，编写 PBIR 图表与 TMDL 度量值，再打开项目 | 图表由 Power BI 读取模型并实际计算，不是逐个鼠标创建图表 | 显示销售额、利润、利润率、订单数、趋势、区域、产品和明细表 |
| 8. 验证交互 | 在真实界面选择 East，再清除筛选 | 指标和各图表随区域变化；核对精确金额 | 区域筛选与恢复全量通过 |
| 9. 保存与重开 | 从 Power BI 保存为 PBIX，关闭后重新打开 | 重开后保留数据与图表 | 最终可编辑文件通过实际打开验证 |
| 10. 整理复现入口 | 实现并运行 `npm run demo:powerbi` | Excel/PBIX 哈希校验通过，应用启动请求成功；本地协议测试 9/9 通过 | 发布报表、源码、截图与客户运行说明 |

本次没有对总耗时、调用次数、无人干预成功率或并发性能做正式测量，不能用这次结果推导生产 SLA 或 ROI。

## 验收数据与证据

| 检查项 | 全部区域 | East 区域 |
| --- | ---: | ---: |
| 订单数 | 240 | 60 |
| 销售额（CNY） | 20,971,620 | 5,142,705 |
| 利润（CNY） | 5,720,151 | 1,409,184 |
| 利润率（显示值） | 27.28% | 27.40% |

全量预期与区域销售额见 [expected.json](../examples/powerbi-sales/expected.json)。East 利润与利润率另见本次应用截图中的明细表；该 JSON 不包含所有区域利润字段。顶部卡片使用默认缩写，精确数值以表格为准。

- [最终 PBIX](../examples/powerbi-sales/SalesOverview.pbix)：Power BI 保存的报表，内嵌模拟数据。
- [模拟 Excel](../examples/powerbi-sales/sales-demo.xlsx)：客户可替换的数据源。
- [原生项目源码](../examples/powerbi-sales/project/)：PBIP、PBIR 和 TMDL，不含 `.pbi` 本机缓存。
- [可本地打开的证据报告](../examples/powerbi-sales/report.html)：切换查看两张实测截图，不是在线 Power BI。

**最终 PBIX 重新打开：**

![全量数据与重开结果](../examples/powerbi-sales/evidence/overview.png)

**真实界面选择 East：**

![East 筛选与图表联动](../examples/powerbi-sales/evidence/east-filter.png)

## 遇到的问题与解决经验

| 现象 | 本次处理 | 后续接入建议 |
| --- | --- | --- |
| 安装调用超时，但安装可能已完成 | 检查实际安装文件、版本和应用启动结果 | 超时代表结果未知；先查询状态，再决定是否重试 |
| 截图范围与实际桌面不一致 | 使用 DPI-aware 截图，按真实像素定位 | 截图接口返回分辨率、缩放与坐标映射 |
| 发送文字后文件名仍为空 | 改用原生编辑控件写入，确认界面再保存 | 输入工具读回实际值，避免只报告“事件已发送” |
| 同名或重复控件导致误定位 | 结合当前窗口和截图定位；必要时使用已观察的坐标 | 控件引用应绑定窗口、可见性与当前状态 |
| 一般启动方式未稳定留下应用进程 | 本次改用 `Win32_Process.Create` 启动，并观察实际窗口 | 为应用启动提供独立的状态查询，不能仅凭进程请求成功判定就绪 |
| 保存按钮匹配到同 ID 的其他对象 | 修正定位并观察保存结果，检查磁盘文件 | 操作后检查文件存在、内容与重新打开情况 |
| 本地协议测试受沙箱监听权限限制 | 在允许回环监听的环境重新运行 | 将环境权限错误与业务测试失败分开记录；最终 9 项通过 |

这些是本次部署与应用组合的观察，不是对所有 SDK、操作系统或实例版本的统一结论。

## 公开内容与保留内容

公开内容仅包含模拟数据报表、经检查的专用演示截图、参考代码与整理后的记录。令牌、完整网关地址、账号配置、原始 MCP 响应和本机缓存均未纳入案例；本记录没有发布原始会话日志。此处截图仅用于证明本次测试，未来运行必须重新验收。

参考：[微软安装说明](https://learn.microsoft.com/en-us/power-bi/fundamentals/desktop-get-the-desktop)、[微软 PBIR 项目格式](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)。
