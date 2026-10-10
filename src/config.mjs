import { readFileSync } from 'node:fs';

export function loadConfig(env = process.env) {
  let raw;
  try {
    raw = env.WUYING_MCP_CONFIG ? JSON.parse(readFileSync(env.WUYING_MCP_CONFIG, 'utf8')) : {
      url: env.WUYING_MCP_URL,
      transport: env.WUYING_MCP_TRANSPORT || 'streamable-http',
      headers: env.WUYING_MCP_TOKEN ? { Authorization: `Bearer ${env.WUYING_MCP_TOKEN}` } : {},
    };
  } catch { throw new Error('Cannot read MCP config JSON. Check WUYING_MCP_CONFIG.'); }
  if (raw.mcpServers) {
    const names = Object.keys(raw.mcpServers);
    const name = env.WUYING_MCP_SERVER || (names.length === 1 ? names[0] : undefined);
    if (!name || !raw.mcpServers[name]) throw new Error('Set WUYING_MCP_SERVER to select one exported server.');
    raw = raw.mcpServers[name];
  }
  function expand(value) {
    if (typeof value === 'string') return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => {
      if (!env[key]) throw new Error(`Missing environment variable: ${key}`);
      return env[key];
    });
    if (Array.isArray(value)) return value.map(expand);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,expand(v)]));
    return value;
  }
  raw = expand(raw);
  let url;
  try { url = new URL(raw.url); } catch { throw new Error('Set WUYING_MCP_URL or WUYING_MCP_CONFIG to the real Wuying MCP endpoint.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('Use HTTPS; HTTP is allowed only on loopback. URL credentials and fragments are unsupported.');
  }
  const transport = env.WUYING_MCP_TRANSPORT || raw.transport || raw.type || 'streamable-http';
  if (!['streamable-http','http','sse'].includes(transport)) throw new Error('Supported transports: streamable-http, sse.');
  const profile = env.WUYING_MCP_PROFILE || raw.profile || 'observe';
  if (!['observe','interactive'].includes(profile)) throw new Error('Profile must be observe or interactive.');
  const timeoutMs = Number(env.WUYING_MCP_TIMEOUT_MS || raw.timeoutMs || 30000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 300000) throw new Error('timeoutMs must be between 100 and 300000.');
  if (raw.allowTools !== undefined && (!Array.isArray(raw.allowTools) || !raw.allowTools.every(x => typeof x === 'string'))) throw new Error('allowTools must be an array of exact tool names.');
  let headers;
  try { headers = Object.fromEntries(new Headers(raw.headers || {}).entries()); } catch { throw new Error('Invalid configured headers.'); }
  return { url, transport, headers, profile, timeoutMs, allowTools: raw.allowTools };
}
