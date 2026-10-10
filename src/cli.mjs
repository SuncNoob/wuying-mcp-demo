import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { WuyingConnection } from './upstream.mjs';

let connection;
try {
  const [command, name, flag, file] = process.argv.slice(2);
  if (!['doctor','tools','call'].includes(command) || (command === 'call' && (!name || flag !== '--args' || !file))) {
    throw new Error('Usage: npm run doctor | npm run tools | npm run call -- TOOL --args arguments.local.json');
  }
  const config = loadConfig();
  connection = await new WuyingConnection(config).connect();
  if (command === 'doctor') {
    console.log(JSON.stringify({ connected: true, profile: config.profile, discovered: connection.discoveredCount, exposed: connection.tools.length, toolNames: connection.tools.map(t => t.name), note: 'Discovery succeeded. No desktop action has been executed.' }, null, 2));
    if (!connection.tools.length) process.exitCode = 2;
  } else if (command === 'tools') console.log(JSON.stringify(connection.tools, null, 2));
  else {
    let args;
    try { args = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error('Cannot read arguments JSON file.'); }
    const result = await connection.call(name, args);
    await mkdir('.artifacts', { recursive: true, mode: 0o700 });
    const output = resolve('.artifacts', `result-${Date.now()}.json`);
    await writeFile(output, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
    console.log(JSON.stringify({ isError: result.isError === true, output, contentTypes: result.content?.map(c => c.type) || [] }, null, 2));
    if (result.isError) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await connection?.close(); }
