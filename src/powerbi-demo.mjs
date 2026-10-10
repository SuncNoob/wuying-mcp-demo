import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { WuyingConnection } from './upstream.mjs';

// This explicit command opts into remote file writes and application launch.
const names = ['aiengine__shell', 'aiengine__write_file'];
const remote = 'C:\\Users\\Public\\WuyingMcpDemo\\powerbi-sales';
const command = ps => 'powershell -NoProfile -NonInteractive -EncodedCommand ' + Buffer.from(ps, 'utf16le').toString('base64');
let connection;
async function call(name, args) {
  const result = await connection.call(name, args);
  if (result.isError) throw new Error(`${name} failed. Check the remote app and permissions; credentials are not printed.`);
  return result.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
}
try {
  connection = await new WuyingConnection({ ...loadConfig(), allowTools: names, timeoutMs: 90000 }).connect();
  for (const name of names) if (!connection.tools.some(t => t.name === name)) throw new Error(`Required tool missing: ${name}`);
  const preflight = await call(names[0], { command: command(`$ErrorActionPreference='Stop';if(!(Test-Path 'C:\\Program Files\\Microsoft Power BI Desktop\\bin\\PBIDesktop.exe')){throw 'Install Power BI Desktop first'};Write-Output 'PBI_READY'`), timeout_ms: 10000 });
  if (!preflight.includes('PBI_READY')) throw new Error('Power BI Desktop preflight failed.');
  for (const file of ['sales-demo.xlsx', 'SalesOverview.pbix']) {
    const bytes = await readFile(new URL(`../examples/powerbi-sales/${file}`, import.meta.url));
    const hash = createHash('sha256').update(bytes).digest('hex');
    const staging = `${remote}\\${file}.${Date.now()}.base64`;
    await call(names[1], { path: staging, content: bytes.toString('base64'), mode: 'overwrite', create_parent_dir: true });
    const result = await call(names[0], { command: command(`$ErrorActionPreference='Stop';$target='${remote}\\${file}';$staging='${staging}';try {if(Test-Path $target){if((Get-FileHash $target -Algorithm SHA256).Hash -ne '${hash}'){throw 'Existing demo file differs; move it aside before rerunning'}}else{[IO.File]::WriteAllBytes($target,[Convert]::FromBase64String([IO.File]::ReadAllText($staging)))};if((Get-FileHash $target -Algorithm SHA256).Hash -ne '${hash}'){throw 'File verification failed'};Write-Output 'FILE_VERIFIED'}finally{Remove-Item $staging -ErrorAction SilentlyContinue}`), timeout_ms: 15000 });
    if (!result.includes('FILE_VERIFIED')) throw new Error(`Could not verify ${file}; an existing modified file may need to be moved aside.`);
    console.log(`Verified on cloud computer: ${file}`);
  }
  const launch = await call(names[0], { command: command(`$ErrorActionPreference='Stop';$r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='"C:\\Program Files\\Microsoft Power BI Desktop\\bin\\PBIDesktop.exe" "${remote}\\SalesOverview.pbix"'};if($r.ReturnValue -ne 0){throw 'Application launch failed'};Write-Output 'LAUNCH_REQUESTED'`), timeout_ms: 15000 });
  if (!launch.includes('LAUNCH_REQUESTED')) throw new Error('Could not confirm application launch request.');
  console.log('Power BI launch requested. In the cloud desktop, confirm 240 orders and CNY 20,971,620 revenue; select East and confirm 60 orders / CNY 5,142,705. Launch alone does not verify the visuals.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await connection?.close();
}
