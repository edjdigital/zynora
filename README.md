# Zynora

**Icon font toolkit for the web** - folder-based SVG/PNG icons, a Vite plugin, generated CSS & font files, and a VitePress doc site with a searchable gallery.

By the [Even7](https://even7.com.br) team. **MIT.**

## Documentation

**[zynora.even7.dev](https://zynora.even7.dev/)** - install, folder layout, gallery, [MCP for assistants](https://zynora.even7.dev/guide/mcp-for-ai).

## Quick start

Add **zynora** to your Vite app (workspace link, local path, or your registry - see [Installation & usage](https://zynora.even7.dev/guide/installation-and-usage)).

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { zynora } from "zynora/vite";

export default defineConfig({
    plugins: [zynora()]
});
```

```ts
import "zynora/css";
```

```html
<i class="zy zyb-picpay" aria-hidden="true"></i>
```

## This repo

| Path | What |
| --- | --- |
| `icons/` | Source icons by style (`icons/{style}/{name}/icon.svg`) |
| `docs/` | VitePress site (`yarn doc:dev` / `yarn doc:build`) |
| `mcp/` | [MCP](https://modelcontextprotocol.io/) server (stdio + optional HTTP) for AI tools |

**Requirements:** Node 18+, Vite ^7 or ^8 for the plugin.

**Docker:** `Dockerfile` + `docker-compose.yml` for static docs; `mcp/Dockerfile` + compose profile `mcp` for remote MCP.

---

Questions and detail live in the **docs site**, not here.
