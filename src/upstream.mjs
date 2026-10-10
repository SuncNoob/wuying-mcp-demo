import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { allowed, describeTool } from './policy.mjs';

export class WuyingConnection {
  constructor(config) { this.config = config; this.tools = []; this.validators = new Map(); this.busy = false; }
  async connect() {
    const c = this.config;
    this.client = new Client({ name: 'wuying-mcp-demo', version: '0.1.0' });
    const guardedFetch = (input, init) => {
      const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (target.origin !== c.url.origin) throw new Error('Cross-origin MCP request blocked.');
      return fetch(input, { ...init, redirect: 'error' });
    };
    const options = { requestInit: { headers: c.headers }, fetch: guardedFetch };
    this.transport = c.transport === 'sse' ? new SSEClientTransport(c.url, options) : new StreamableHTTPClientTransport(c.url, options);
    let timer;
    try {
      await Promise.race([
        this.client.connect(this.transport),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timeout.')), c.timeoutMs); }),
      ]);
      clearTimeout(timer);
      const tools = [], cursors = new Set();
      let cursor;
      do {
        const page = await this.client.listTools(cursor ? { cursor } : {}, { timeout: c.timeoutMs });
        tools.push(...page.tools);
        cursor = page.nextCursor;
        if (cursor && (cursors.has(cursor) || cursors.size >= 100)) throw new Error('Invalid MCP tool pagination.');
        if (cursor) cursors.add(cursor);
      } while (cursor);
      this.discoveredCount = tools.length;
      this.tools = tools.filter(t => allowed(t.name, c)).map(describeTool);
      const seen = new Set();
      for (const tool of this.tools) {
        if (seen.has(tool.name)) throw new Error('Duplicate tool names.');
        seen.add(tool.name);
        const Compiler = tool.inputSchema.$schema?.includes('2020-12') ? Ajv2020 : Ajv;
        const ajv = new Compiler({ strict: false, validateFormats: false });
        this.validators.set(tool.name, ajv.compile(tool.inputSchema));
      }
      return this;
    } catch {
      await this.close();
      throw new Error('MCP connection/discovery failed. Check endpoint, transport, credentials, running cloud computer and schemas. Raw server errors are omitted to avoid leaking credentials.');
    } finally { clearTimeout(timer); }
  }
  async call(name, args) {
    const validate = this.validators.get(name);
    if (!validate) throw new Error('Tool is unavailable or excluded by the configured profile.');
    if (!validate(args)) throw new Error('Arguments do not match the discovered inputSchema. Run npm run tools to inspect it.');
    if (this.busy) throw new Error('Another tool call is running. Wait before controlling the same desktop.');
    this.busy = true;
    try {
      return await this.client.callTool({ name, arguments: args }, undefined, { timeout: this.config.timeoutMs });
    } catch {
      // A timeout does not prove the remote action stopped. Never retry automatically.
      throw new Error('MCP call failed or timed out. Remote execution may still be running; inspect the desktop before retrying.');
    } finally { this.busy = false; }
  }
  async close() { try { await this.client?.close(); } catch {} }
}
