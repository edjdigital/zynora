# MCP for AI assistants

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) lets coding assistants and other MCP clients query **Zynora** without scraping the site: icon catalog search, single-icon lookup, and a short usage reference.

## How to use it {#how-to-use}

1. **Configure your MCP client** once (stdio or remote URL - see below). The client starts or connects to the Zynora MCP server.
2. **Reload / restart** the client if it does not pick up the new server immediately.
3. **Chat with your assistant** as usual. When it needs Zynora facts, it can call tools such as `zynora_search_icons` or `zynora_get_icon` on its own. You do **not** run those tool names yourself in a terminal.
4. **Ask in plain language**, for example:
   - *“What HTML do I use for the PicPay icon in Zynora?”*
   - *“Search Zynora icons matching `wallet`.”*
   - *“What styles exist in the Zynora catalog?”*
   - *“Give me the Vite setup snippet for Zynora.”* (may use the `zynora://docs/quickstart` resource)

If the assistant says it has no Zynora tools, the MCP server is not connected - fix the config first.

## Do you need to install?

| How you connect | Install this repo’s `mcp/` package locally? |
| --- | --- |
| **Remote MCP (HTTPS URL)** | **Usually no.** If a Streamable HTTP endpoint is already deployed (your team or this project’s infra), you only configure that URL in an MCP client that supports remote HTTP. No `npm install` in `mcp/` on your laptop. |
| **stdio** | **Yes.** The client runs `node` on `mcp/src/index.mjs`, so you need Node, dependencies (`npm install` in `mcp/`), and a path to those files (typically a local clone). |

**Hosting** the HTTP server (Docker, Node on a VM, etc.) is separate: whoever runs that service installs or builds once on the server - not every assistant user.

## What you get

| Tool | Purpose |
| --- | --- |
| `zynora_search_icons` | Filter by optional `query` and `style`; returns classes, HTML snippet, code point, SVG preview |
| `zynora_get_icon` | Resolve one icon by `slug` or `classId` (optional `style` with `slug` if names repeat across styles) |
| `zynora_list_styles` | List style keys and labels in the current catalog |

| Resource | URI | Purpose |
| --- | --- | --- |
| Quick reference | `zynora://docs/quickstart` | Markdown: Vite setup, HTML classes, folder layout |

## Local (stdio) - full setup {#local-stdio}

Do this on the **same machine** where your IDE runs (the IDE will spawn `node` for you).

1. **Install Node.js** (18+). Check with `node -v`.
2. **Get the zynora repo** on disk (clone, submodule, or monorepo path). Remember the folder that contains both `mcp/` and `docs/` - call that `ZYNORA_ROOT`.
3. **Generate icon data** (needed for a full catalog when developing icons locally):

   ```bash
   cd ZYNORA_ROOT
   yarn doc:data
   ```

   Skip only if you are fine with the server loading the public JSON from `ZYNORA_ICONS_URL` (see env vars).

4. **Install MCP dependencies**:

   ```bash
   cd ZYNORA_ROOT/mcp
   npm install
   ```

5. **Resolve the real path** to the entry file, e.g. `/home/you/projects/zynora/mcp/src/index.mjs` (no `~`; use an absolute path).

6. **Add the server in your MCP client.** Example for **Cursor**: open **Settings → MCP** (or edit your MCP config file, depending on Cursor version) and merge something like:

   ```json
   {
     "mcpServers": {
       "zynora": {
         "command": "node",
         "args": ["/absolute/path/to/zynora/mcp/src/index.mjs"],
         "env": {}
       }
     }
   }
   ```

7. **Enable the server** in the UI if there is a toggle, then open a new chat and ask a Zynora question. You should see tools/resources listed for that server when the connection works.

### Optional env for stdio

| Variable | When to set |
| --- | --- |
| `ZYNORA_PACKAGE_ROOT` | If `node` runs with a cwd where the parent of `mcp/` is not the zynora package root |
| `ZYNORA_ICONS_JSON` | Point at a specific `icons.json` file |
| `ZYNORA_ICONS_URL` | Prefer downloading catalog from a URL instead of local `doc:data` output |

Run **`zynora-mcp`** from `mcp/` (see `package.json` → `bin`) only if you want to test stdio manually; the IDE normally runs `node …/index.mjs` directly.

## Remote (Streamable HTTP)

Same tools over **HTTP** for clients that support remote MCP.

### Using a hosted URL (no local `mcp/` install)

1. Get the **full MCP base URL** from whoever runs the server, including path - e.g. `https://example.com/mcp` (trailing slash usually does not matter; use what they document).
2. In your MCP client, **add an HTTP / remote MCP server** (name varies: “Streamable HTTP”, “URL”, “Remote”, etc.) and paste that URL.
3. Save, reload MCP, open a chat, and ask a Zynora question as in [How to use it](#how-to-use).

**Example target:** `https://zynora.even7.dev/mcp` - only works **after** that HTTP endpoint is deployed behind your docs domain; the static VitePress site alone does not serve MCP.

If your client **only** supports **command + args** (stdio), you cannot use a raw HTTPS URL there - use [Local (stdio)](#local-stdio) instead.

### Running the HTTP server yourself

For **you** (or ops): install once on the host that will accept connections, then give users the public `https://…/mcp` URL.

```bash
cd mcp
npm install
npm run start:http
```

Defaults: `http://127.0.0.1:3333/mcp`, JSON responses (`ZYNORA_MCP_HTTP_JSON` unset or not `0`), **stateful** sessions (`Mcp-Session-Id` on responses after `initialize`).

**Sanity check** (optional): `curl -sS http://127.0.0.1:3333/health` should print `ok`. MCP itself is spoken on `/mcp`, not in the browser address bar.

### Docker (optional)

From the **zynora** package root (build context must be this folder):

```bash
docker build -f mcp/Dockerfile -t zynora-mcp .
docker run --rm -p 3333:3333 zynora-mcp
```

Or with Compose (service is behind the **`mcp`** profile so plain `up` still only runs docs):

```bash
docker compose --profile mcp up -d zynora-mcp
```

### Reverse proxy

- Prefer **HTTPS** in production.
- If you disable JSON mode (`ZYNORA_MCP_HTTP_JSON=0`), responses may use **SSE**; configure your proxy with buffering disabled for that location (see your stack’s MCP / SSE docs).
- Clients must send an **`Accept`** header that includes **both** `application/json` and `text/event-stream` on MCP POSTs (per the Streamable HTTP transport).

### Security

The MCP surface is **read-only** (icon metadata + docs text) but still reachable over the network. Put it behind **TLS**, consider **authentication** or network restrictions, and **rate limiting** if the endpoint is public.

## Environment variables

### Catalog (stdio and HTTP)

| Variable | Description |
| --- | --- |
| `ZYNORA_PACKAGE_ROOT` | Absolute path to the **zynora** package (parent of `mcp/`). Defaults to the parent of `mcp/` when running from this repo. |
| `ZYNORA_ICONS_JSON` | Absolute path to a catalog JSON file (`{ "icons": [ ... ] }`). Overrides local file discovery. |
| `ZYNORA_ICONS_URL` | URL for the catalog JSON. Default: `https://zynora.even7.dev/zynora-icons.json`. |

### HTTP only

| Variable | Default | Description |
| --- | --- | --- |
| `ZYNORA_MCP_HOST` | `127.0.0.1` | Listen address (`0.0.0.0` in Docker image). |
| `ZYNORA_MCP_PORT` / `PORT` | `3333` | Listen port. |
| `ZYNORA_MCP_HTTP_PATH` | `/mcp` | URL path for MCP. |
| `ZYNORA_MCP_HTTP_JSON` | `1` (enabled) | Set to `0` for SSE-style responses instead of JSON bodies. |
| `ZYNORA_MCP_SESSION_TTL_MS` | `1800000` (30m) | Drop idle sessions server-side. |
| `ZYNORA_MCP_BODY_LIMIT` | `2097152` | Max JSON body bytes per POST. |
| `ZYNORA_MCP_CORS` | unset | Set to `1` to answer browser preflights (optional). |
| `ZYNORA_MCP_CORS_ORIGIN` | `*` | `Access-Control-Allow-Origin` when CORS is on. |
| `ZYNORA_MCP_DNS_REBINDING` | unset | Set to `1` and set `ZYNORA_MCP_ALLOWED_HOSTS` / `ZYNORA_MCP_ALLOWED_ORIGINS` (comma-separated) to enable SDK DNS rebinding checks. |

## Catalog file for the web

`yarn doc:data` writes:

- `docs/.vitepress/data/icons.json` - VitePress gallery
- `docs/public/zynora-icons.json` - site root after build, e.g. [https://zynora.even7.dev/zynora-icons.json](https://zynora.even7.dev/zynora-icons.json)

Rebuild and redeploy docs when icons change.

## Further reading

- [Installation & usage](./installation-and-usage.md)
- [Icon folders & metadata](./icon-folders.md)
- Live gallery: [Icons gallery](/icons/gallery)
