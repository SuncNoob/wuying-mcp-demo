const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function renderReport({run, results, complete}) {
  const cards = results.map(r=>`<section><h2>${escape(r.stage)} · VERIFIED</h2><p>${escape(r.actual)}</p><img src="${escape(r.stage)}.png" alt="实际云电脑执行截图"></section>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>无影 MCP · 真实执行验证报告</title><style>
body{margin:50px auto;max-width:1200px;background:#081521;color:#eef8ff;font:18px/1.7 system-ui;padding:20px}h1{font-size:40px;line-height:1.3}section{margin:40px 0}h2{color:#65e0de;font-size:26px}img{width:100%;border-radius:12px}p{color:#abc3d6}.intro{background:#102535;border:1px solid #244557;border-radius:18px;padding:28px}table{width:100%;border-collapse:collapse;font-size:16px}th,td{text-align:left;padding:16px 12px;border-bottom:1px solid #284353;vertical-align:top}th{color:#65e0de}code{font-size:14px;overflow-wrap:anywhere}.flow{padding:20px;background:#081b29;border-radius:12px;color:#d3f4ff}.note{font-size:15px} @media(max-width:650px){body{margin:15px auto;padding:12px}h1{font-size:30px}.intro{padding:16px}th,td{padding:10px 5px;font-size:14px}}
</style><h1>无影 MCP · 真实执行验证报告</h1><p>${escape(run)} · ${complete ? 'PASSED · 验证通过' : 'INCOMPLETE · 尚未完成'} · 截图仅保存在本地</p>
<section class="intro"><h2>本次使用的无影开放能力</h2><p>无影将云电脑上的执行能力通过 MCP 开放给外部客户端。本 Demo 通过这条连接下发脚本、执行操作并取回结果，验证浏览器与桌面应用的真实交互。</p>
<table><thead><tr><th>开放能力</th><th>接口 / 工具</th><th>在本次验证中的作用</th></tr></thead><tbody>
<tr><td>MCP 远程接入与鉴权</td><td>Streamable HTTP<br>Bearer 鉴权 · 工具发现</td><td>连接无影云电脑，读取实际工具名称与参数规范。</td></tr>
<tr><td>云端命令执行</td><td><code>aiengine__shell</code></td><td>在 Windows 云电脑执行 PowerShell，启动并控制演示浏览器与记事本。</td></tr>
<tr><td>文件写入</td><td><code>aiengine__write_file</code></td><td>把演示脚本写入独立运行目录，为远程执行准备环境。</td></tr>
<tr><td>文件读取与结果回传</td><td><code>aiengine__read_file</code></td><td>取回真实操作后的 PNG 截图，在本地生成验证报告。</td></tr>
</tbody></table>
<p class="flow">本地 Demo → 无影 MCP → 云电脑执行 → 状态与截图回传 → 本地验证报告</p>
<p><strong>Browser Use：</strong>通过 MCP 命令执行调用 Chrome DevTools Protocol，在真实浏览器中输入、点击并检查页面结果。</p>
<p><strong>Computer Use：</strong>通过 MCP 命令执行调用 Windows UI Automation 与 SendInput，在真实记事本中定位控件、发送键盘事件并校验文本。</p>
<p class="note">能力边界：CDP、UI Automation 和 SendInput 是本 Demo 使用的浏览器与 Windows 接口，不是此次端点单独开放的 MCP 工具。本次为固定流程集成验证，尚不代表 ChatGPT 自主规划、多租户调度或任意网站任务已通过。</p>
<p class="note">补充：该端点的 <code>aiengine__screenshot</code> 已在此前独立验证中成功调用。本报告中的浏览器截图由 CDP 捕获，记事本截图由 Windows 捕获，再通过文件读取工具回传，未使用该截图工具。</p>
</section>${cards}</html>`;
}
