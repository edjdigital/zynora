# Zynora

Zynora is a **folder-based icon set** for web projects. Each icon lives in its own directory with an optional `doc.md` for metadata. A **Vite plugin** compiles SVG (or PNG) sources into a single webfont plus CSS. Documentation is a **VitePress** site: introduction, installation, folder conventions, **local search**, and an **interactive icon gallery** (fuzzy search, style filters, click for detail + `doc.md` body).

**Zynora is an icon font toolkit created by the [Even7](https://even7.com.br) team.**

## Layout

Icons are grouped by **style** (similar to Font Awesome “solid” vs “brands”):

```text
icons/
  solid/
    .zynora.yaml          # optional: classPrefix, label
    star/
      icon.svg            # required (or icon.png)
      doc.md              # optional: YAML frontmatter + markdown body
  brands/
    .zynora.yaml
    picpay/
      icon.svg
      doc.md
```

### Style config (`icons/{style}/.zynora.yaml`)

| Field | Description |
| --- | --- |
| `classPrefix` | Short prefix for CSS classes in that style. Defaults: `solid` → `zys`, `brands` → `zyb`, otherwise the style folder name. |
| `label` | Human-readable name shown in the docs site (defaults to a title-cased slug). |

### Optional `doc.md` (trademark)

Only **`trademark: true|false`** is used. All icons under **`icons/brands/`** default to **`trademark: true`** (shows a Font Awesome-style notice in the docs). **`icons/solid/`** defaults to **`false`**. Override per folder in `doc.md` frontmatter when needed.

## Usage in HTML

With the Vite plugin, import the virtual stylesheet once:

```ts
import "zynora/css";
```

Then use **two classes** on the **same element**: the family class (`zy`) and the icon class (`zys-*` or `zyb-*`):

```html
<i class="zy zys-star" aria-hidden="true"></i>
<i class="zy zyb-picpay" aria-hidden="true"></i>
```

## Vite

```ts
import { defineConfig } from "vite";
import { zynora } from "zynora/vite";

export default defineConfig({
    plugins: [zynora()]
});
```

Defaults:

- Reads icons from this package’s `icons/` tree (and optionally merges your app `input`).
- Writes the kit to `public/zynora` in your app.
- Sets `fontsUrl` to `/zynora/` when that folder is inside Vite’s `public` directory.

Override with `input`, `output`, `fontsUrl`, `fontName`, or `baseClass` if needed. Use **`packageIcons: false`** for app-only icons (**`input`** is required in that case).

## Documentation site (VitePress)

From the `zynora` package directory:

```bash
# Regenerate docs/.vitepress/data/icons.json (temporary font build for code points)
yarn doc:data

# Edit / preview at http://localhost:5173 (or the port VitePress prints)
yarn doc:dev

# Production build → docs/.vitepress/dist/
yarn doc:build
```

The gallery uses [Fuse.js](https://fusejs.io/) for fuzzy search on **slug**, **CSS class**, and **style**. **VitePress local search** indexes the Markdown guides separately.

## Docker (static docs)

A `Dockerfile` and `docker-compose.yml` at the package root serve the static build with nginx (handy on Dokploy). Set the Docker **build context** to the **`zynora`** folder. If the default host port is already taken, set **`ZYNORA_DOCS_PORT`**.

## Build via API (no Vite plugin)

The recommended path is the Vite plugin. For scripts or other bundlers, `buildIconFont()` follows the same defaults as the plugin (`public/zynora`, names, and inferred `fontsUrl` when applicable).

```js
import { buildIconFont } from "zynora";

await buildIconFont();

await buildIconFont({
    packageIcons: false,
    inputDir: "./icons"
});
```

## Requirements

- Node.js 18+
- Peer: `vite` ^7 or ^8 when using `zynora/vite`

## License

MIT License.
