import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WuyingConnection } from '../src/upstream.mjs';
import { loadConfig } from '../src/config.mjs';

// Protocol fixture only. These schemas/results do NOT represent an actual Wuying deployment.
const tools = [
  { name: 'screenshot', inputSchema: { type: 'object', additionalProperties: false } },
  { name: 'browser_navigate', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } },
  { name: 'shell', inputSchema: { type: 'object' } },
];
async function fixture(t, { sse = false, delay = 0, result } = {}) {
  let calls = 0, transport;
  const protocol = new Server({ name: 'protocol-test-only', version: '1.0' }, { capabilities: { tools: {} } });
  protocol.setRequestHandler(ListToolsRequestSchema, async r => r.params?.cursor ? { tools: tools.slice(1) } : { tools: tools.slice(0,1), nextCursor: 'page2' });
  protocol.setRequestHandler(CallToolRequestSchema, async () => {
    calls++;
    if (delay) await new Promise(r => setTimeout(r, delay));
    return result || { content: [{ type: 'image', mimeType: 'image/png', data: 'aGVsbG8=' }] };
  });
  if (!sse) { transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, enableJsonResponse: true }); await protocol.connect(transport); }
  const http = createServer(async (req,res) => {
    if (req.headers.authorization !== 'Bearer fixture-only') { res.writeHead(401).end(); return; }
    try {
      if (sse && req.method === 'GET') { transport = new SSEServerTransport('/messages', res); await protocol.connect(transport); }
      else if (sse) await transport.handlePostMessage(req,res);
      else await transport.handleRequest(req,res);
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise(r => http.listen(0,'127.0.0.1',r));
  t.after(async () => { await protocol.close(); http.closeAllConnections(); await new Promise(r => http.close(r)); });
  const config = loadConfig({ WUYING_MCP_URL: `http://127.0.0.1:${http.address().port}/mcp`, WUYING_MCP_TOKEN: 'fixture-only', WUYING_MCP_TRANSPORT: sse ? 'sse' : 'streamable-http' });
  return { config, calls: () => calls };
}
for (const sse of [false,true]) test(`${sse ? 'SSE' : 'HTTP'}: auth, pagination, policy, schema and image passthrough`, async t => {
  const f = await fixture(t, {sse});
  const c = await new WuyingConnection(f.config).connect();
  t.after(() => c.close());
  assert.equal(c.discoveredCount,3);
  assert.deepEqual(c.tools.map(t => t.name), ['screenshot']);
  await assert.rejects(c.call('browser_navigate',{url:'https://example.com'}), /excluded/);
  await assert.rejects(c.call('screenshot',{unexpected:1}), /inputSchema/);
  assert.equal(f.calls(),0);
  const r = await c.call('screenshot',{});
  assert.equal(r.content[0].data,'aGVsbG8=');
  assert.equal(f.calls(),1);
});
test('interactive profile allows browser input but excludes shell', async t => {
  const f = await fixture(t);
  const c = await new WuyingConnection({...f.config, profile:'interactive'}).connect();
  t.after(() => c.close());
  assert.deepEqual(c.tools.map(t => t.name), ['screenshot','browser_navigate']);
  assert.equal(c.tools[1].annotations.readOnlyHint,false);
  await assert.rejects(c.call('browser_navigate',{}), /inputSchema/);
  await c.call('browser_navigate',{url:'https://example.com'});
  assert.equal(f.calls(),1);
});
test('authentication failures omit endpoint and token', async t => {
  const f = await fixture(t);
  await assert.rejects(new WuyingConnection({...f.config, headers:{Authorization:'Bearer SECRET'}}).connect(), error => {
    assert.doesNotMatch(error.message,/SECRET|127\.0\.0\.1|fixture-only/); return true;
  });
});
test('remote tool error is preserved', async t => {
  const f = await fixture(t,{result:{isError:true,content:[{type:'text',text:'test failure'}]}});
  const c = await new WuyingConnection(f.config).connect(); t.after(() => c.close());
  assert.equal((await c.call('screenshot',{})).isError,true);
});
test('timeout is not automatically retried; concurrent calls rejected', async t => {
  const f = await fixture(t,{delay:350});
  const c = await new WuyingConnection({...f.config,timeoutMs:100}).connect(); t.after(() => c.close());
  const pending = c.call('screenshot',{});
  await assert.rejects(c.call('screenshot',{}),/Another tool/);
  await assert.rejects(pending,/may still be running/);
  assert.equal(f.calls(),1);
});
test('stdio bridge end-to-end tool listing and real protocol forwarding', async t => {
  const f = await fixture(t);
  const child = new StdioClientTransport({ command: process.execPath, args:['src/bridge.mjs'], env:{
    ...process.env, WUYING_MCP_CONFIG:'', WUYING_MCP_URL:f.config.url.href, WUYING_MCP_TOKEN:'fixture-only', WUYING_MCP_PROFILE:'interactive', WUYING_MCP_TRANSPORT:'streamable-http',
  }, stderr:'pipe' });
  const client = new Client({name:'test-client',version:'1'});
  t.after(() => client.close());
  await client.connect(child);
  assert.equal((await client.listTools()).tools.length,2);
  assert.equal((await client.callTool({name:'screenshot',arguments:{}})).content[0].type,'image');
  const blocked = await client.callTool({name:'shell',arguments:{}});
  assert.equal(blocked.isError,true);
});
test('configuration rejects unsafe URLs and invalid profiles', () => {
  for (const url of ['http://example.com/mcp','https://user:secret@example.com/mcp','file:///mcp']) assert.throws(() => loadConfig({WUYING_MCP_URL:url}));
  assert.throws(() => loadConfig({WUYING_MCP_URL:'https://example.com/mcp',WUYING_MCP_PROFILE:'all'}));
  assert.equal(loadConfig({WUYING_MCP_URL:'https://example.com/mcp'}).profile,'observe');
});
test('HTTP redirects are blocked before credentials leave the endpoint', async t => {
  let received = 0;
  const other = createServer((req,res) => { received++; res.writeHead(200).end(); });
  await new Promise(r => other.listen(0,'127.0.0.1',r));
  const redirect = createServer((req,res) => res.writeHead(307,{location:`http://127.0.0.1:${other.address().port}/leak`}).end());
  await new Promise(r => redirect.listen(0,'127.0.0.1',r));
  t.after(async () => {
    for (const server of [redirect,other]) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  });
  const config = loadConfig({WUYING_MCP_URL:`http://127.0.0.1:${redirect.address().port}/mcp`,WUYING_MCP_TOKEN:'fixture-only'});
  await assert.rejects(new WuyingConnection(config).connect(), /connection\/discovery failed/);
  assert.equal(received,0);
});
