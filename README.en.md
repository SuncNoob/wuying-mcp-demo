# Wuying MCP Demo

[中文](README.md)

A runnable MCP client and stdio bridge that connects an AI client to **your real Wuying cloud computer**. The AI plans; Wuying tools operate the remote browser and desktop; observations and screenshots return to the conversation.

This is a reference integration, not an official Alibaba Cloud SDK. It does not provision cloud resources or simulate a desktop.

**Validation status:** local protocol tests cover Streamable HTTP, legacy SSE, authentication, tool discovery, argument validation, image forwarding, errors and stdio bridging. On 2026-10-10, a real Wuying endpoint passed authentication, tool discovery (8 tools) and desktop screenshot execution. That endpoint did not expose browser or mouse/keyboard tools. Browser input/click and Notepad keyboard input were subsequently verified on the real cloud computer via MCP shell, CDP and Windows UI Automation/SendInput. ChatGPT account integration remains unverified.

## Quick start

Node.js 22.9+ or 24 LTS required.

```bash
git clone https://github.com/SuncNoob/wuying-mcp-demo.git
cd wuying-mcp-demo
npm ci
cp .env.example .env
# Edit .env with the actual Wuying endpoint and authentication.
npm run doctor
npm run tools
```

`doctor` discovers tools without executing desktop actions. Tool names and arguments come from the remote `tools/list`; availability varies by deployment. Set `WUYING_MCP_PROFILE=interactive` and restart the bridge to enable supported browser/desktop input. The default `observe` profile only exposes known observation tools.

Choose an available tool and write arguments matching its actual `inputSchema` into `arguments.local.json`:

```bash
npm run call -- ACTUAL_TOOL_NAME --args arguments.local.json
```

Results, including image content, are saved under ignored `.artifacts/`. Configuration and result files should stay local. Calls are serialized per process and never automatically retried. A timeout does not prove the remote action stopped.

## Run the verified Windows demo

After configuring `.env`, run `npm run demo` (or `npm run demo -- browser` / `-- desktop`). It explicitly enables the aiengine shell, write_file and read_file tools for this process. A logged-in, unlocked 64-bit Windows desktop with PowerShell, Chrome/Edge and compatible Notepad is required.

The browser flow uses an isolated profile and CDP input/click events on a bundled test page. The desktop flow opens a uniquely named empty document in real Notepad, checks focus, sends Unicode keyboard events and verifies the actual text. A local `.artifacts/run-*/report.html` contains real screenshots. Cloud demo files remain under `C:\Users\Public\WuyingMcpDemo`; close the demo tabs before removing them.

This is a deterministic integration demo, not an autonomous agent or proof of arbitrary website compatibility. It does not claim the remote server exposes native browser/keyboard tools. See [implementation notes](docs/runnable-demo.md).

## Connect an AI client

For a stdio-compatible client, launch:

```bash
node --env-file=/absolute/path/.env /absolute/path/src/bridge.mjs
```

For ChatGPT, use an authorized [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) to this stdio bridge, or a compatible HTTPS remote MCP endpoint. Tunnel operation requires its own runtime credentials and permissions. The bridge itself does not call an OpenAI model API. See [ChatGPT setup](docs/chatgpt.md) (Chinese) and the [official connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Demo tasks

- Browser Use: open `https://example.com` on the remote browser, inspect its current snapshot, click “Learn more” using the current element reference, then verify the actual destination and capture a screenshot if supported.
- Computer Use: open an empty text editor on the cloud computer first. Ask the AI to inspect the desktop, locate that editor, type “Hello from Wuying MCP”, and capture a fresh screenshot. Do not save or close anything.

Use only the Wuying connection. Stop if required tools are absent or the target is ambiguous. Browser element references and desktop screen coordinates are different interfaces; follow the discovered schemas.

## Configuration

Environment variables are listed in `.env.example`. For custom headers, copy `examples/config.example.json` to ignored `config.local.json` and set `WUYING_MCP_CONFIG` to its absolute path. Exported `mcpServers` remote configurations are supported; choose `WUYING_MCP_SERVER` if more than one exists. `${ENV_NAME}` placeholders are expanded locally. OAuth login/refresh and exported stdio `command` configurations are not implemented.

An explicit `allowTools` array in the local JSON replaces the profile allowlist. Shell, arbitrary script execution, installation and destructive file tools are excluded by default. Tool results may contain private desktop data; use a dedicated demo environment. Multiple bridge processes are not coordinated.

```bash
npm test
npm audit
```

MIT License. Tests use a local protocol fixture only; they are not evidence of real cloud execution.

## Real Windows application: Power BI

The [Power BI case](examples/powerbi-sales/README.md) includes a working PBIX, synthetic Excel data, editable PBIP source, and screenshots of live region filtering. Run `npm run demo:powerbi` with Power BI already installed on the cloud PC to transfer and launch the supplied report.

## Test history and productization notes

- [Power BI test record (Chinese)](docs/powerbi-test-record.md): chronological steps, observed failures, fixes, evidence and unverified scope.
- [MCP / App improvement proposals (Chinese)](docs/mcp-improvements.md): proposals, not implemented capabilities.
- [Verification index](docs/verification.md): separates protocol tests, real cloud execution and account/App integration.

The Power BI case was verified on 2026-10-10, including region filtering, saving and reopening. Its launcher reuses the supplied report; it does not repeat the full installation and authoring process. Only reviewed screenshots of synthetic demo data are published. Credentials and raw MCP responses remain local.
