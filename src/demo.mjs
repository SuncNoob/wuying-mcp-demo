import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { WuyingConnection } from './upstream.mjs';
const mode = process.argv[2] || 'all';
if (!['all','browser','desktop'].includes(mode)) throw new Error('Usage: npm run demo -- [all|browser|desktop]');
// Explicit demo command opts into these three tools for the duration of this process only.
const names = ['aiengine__shell','aiengine__write_file','aiengine__read_file'];
const run = `run-${Date.now()}`;
const remote = `C:\\Users\\Public\\WuyingMcpDemo\\${run}`;
const output = fileURLToPath(new URL(`../.artifacts/${run}/`, import.meta.url));
await mkdir(output, {recursive:true,mode:0o700});
let c;
async function call(name,args) {
  const result = await c.call(name,args);
  if (result.isError) { await writeFile(`${output}error.json`,JSON.stringify(result,null,2),{mode:0o600}); throw new Error(`Remote ${name} returned an error. Details: ${output}error.json`); }
  return result;
}
function command(ps) { return 'powershell -NoProfile -NonInteractive -EncodedCommand '+Buffer.from(ps,'utf16le').toString('base64'); }
async function screenshot(stage) {
  const r = await call(names[2],{path:`${remote}\\${stage}.png`,format:'binary'});
  await writeFile(`${output}${stage}-response.json`,JSON.stringify(r),{mode:0o600});
  const image=r.content.find(x=>x.type==='image');
  let data=image?.data;
  if (!data) {
    for (const block of r.content.filter(x=>x.type==='text')) {
      const text=block.text.trim();
      try { const value=JSON.parse(text); data=value.data || value.content || value.base64; } catch { if (/^[A-Za-z0-9+/=\r\n]+$/.test(text)) data=text; }
      if (typeof data==='string') break;
    }
  }
  if (typeof data!=='string') throw new Error('Cannot decode screenshot result; raw response saved locally.');
  const bytes=Buffer.from(data,'base64');
  if (bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('Screenshot is not a PNG.');
  await writeFile(`${output}${stage}.png`,bytes,{mode:0o600});
}
const results=[];
try {
  c=await new WuyingConnection({...loadConfig(),allowTools:names,timeoutMs:90000}).connect();
  if (!names.every(n=>c.tools.some(t=>t.name===n))) throw new Error('This Windows demo needs the aiengine shell, write_file and read_file tools.');
  for (const stage of mode==='all' ? ['browser','desktop'] : [mode]) {
    console.log(`Running ${stage} on the Wuying cloud computer...`);
    const content=await readFile(new URL(`../remote/${stage}.ps1`,import.meta.url),'utf8');
    const path=`${remote}\\${stage}.ps1`;
    await call(names[1],{path,content,create_parent_dir:true,mode:'overwrite'});
    try {
      const r=await call(names[0],{command:`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${path}"`,timeout_ms:60000});
      const text=r.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
      const line=text.split(/\r?\n/).find(x=>x.startsWith('{') && x.includes('"verified"'));
      if (!line) throw new Error(`${stage} returned no verification. Check the remote script output in ${remote}.`);
      const result=JSON.parse(line);
      if (result.verified!==true || result.stage!==stage) throw new Error(`${stage} verification failed.`);
      await screenshot(stage);
      results.push(result);
      console.log(`${stage}: VERIFIED — ${result.actual}`);
    } finally {
      if(stage==='browser') {
        // Stop only the browser process whose command line contains this unique demo profile.
        await call(names[0],{command:command(`$f='${remote}\\browser.pid'; if(Test-Path $f){$browserId=[int](Get-Content $f);$p=Get-CimInstance Win32_Process -Filter "ProcessId=$browserId";if($p -and $p.CommandLine.Contains('${remote}\\chrome-profile')){Stop-Process -Id $browserId -ErrorAction Stop}}`),timeout_ms:10000});
      }
    }
  }
} catch(error) { console.error(error.message);process.exitCode=1; }
finally {
  await writeFile(`${output}report.json`,JSON.stringify({run,results,complete:!process.exitCode},null,2),{mode:0o600});
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cards=results.map(r=>`<section><h2>${escape(r.stage)} · VERIFIED</h2><p>${escape(r.actual)}</p><img src="${r.stage}.png" alt="Actual cloud execution screenshot"></section>`).join('');
  await writeFile(`${output}report.html`,`<!doctype html><meta charset="utf-8"><title>Wuying MCP · Execution Report</title><style>body{margin:50px auto;max-width:1200px;background:#081521;color:#eef8ff;font:18px system-ui;padding:20px}h1{font-size:44px}section{margin:40px 0}h2{color:#65e0de}img{width:100%;border-radius:12px}p{color:#abc3d6}</style><h1>Wuying MCP · Real execution</h1><p>${escape(run)} · ${process.exitCode ? 'INCOMPLETE' : 'PASSED'} · Screenshots stay local</p>${cards}`,{mode:0o600});
  await c?.close();
  console.log(`Local evidence: ${output}`);
}
