# Installation & usage

## In a Vite project

1. Add the **zynora** package to your project (workspace link, `yarn add`, or equivalent).

2. Register the plugin in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { zynora } from "zynora/vite";

export default defineConfig({
    plugins: [zynora()]
});
```

### Defaults

| Setting | Default |
| --- | --- |
| Package icons | `packageIcons: true` - built-in `icons/` from **zynora** |
| App icons | Optional `input`; merged on top of package icons when both are set |
| Output | `public/zynora` (relative to Vite `root`) |
| `fontsUrl` in generated file | Default: **`./`** (relative to the `.css` file) so `vite build` resolves fonts next to the stylesheet. Set `fontsUrl` only if you need a fixed prefix (e.g. CDN). In dev, the virtual module rewrites URLs for `publicDir` / `/@zynora/*`. |
| Output **outside** `publicDir` | In dev, the virtual stylesheet may use `/@zynora/*` (middleware). In `vite build`, the real `{output}/{fontName}.css` uses relative `url(./…)` next to the font files. Set `fontsUrl` if you host fonts elsewhere. |
| `vite build` | `import "zynora/css"` resolves to the generated **`{output}/{fontName}.css` on disk**, so `url(./zynora.woff2)` is resolved next to that file (no virtual CSS, no Rolldown warnings for `url(/zynora/...)`). |
| Font / file base name | `zynora` |
| Family CSS class | `zy` |

Override when needed:

```ts
zynora({
    input: "path/to/icons",
    output: "public/my-icons",
    fontsUrl: "/my-icons/",
    fontName: "myicons",
    baseClass: "mi"
})
```

3. **Import the virtual stylesheet** once in your app entry (Vite processes it like normal CSS - minify, `?inline`, etc.):

```ts
import "zynora/css";
```

The plugin reads the generated `zynora.css` from your configured `output` folder after each icon build. Alternatively you can still load the file from `public` (e.g. `import "/zynora/zynora.css"`) if you prefer not to use the virtual module.

4. **Use markup** with both classes on the **same element**:

```html
<i class="zy zys-star" aria-hidden="true"></i>
<i class="zy zyb-picpay" aria-hidden="true"></i>
```

- **`zy`** - family class (`baseClass`).
- **`zys-star` / `zyb-picpay`** - icon id from folder layout and `.zynora.yaml` (see [Icon folders & metadata](./icon-folders.md)).

### Accessibility

Prefer **`aria-hidden="true"`** on decorative icons. If an icon conveys meaning, use visible text or `aria-label` on a wrapping control.

## Build via API (without the Vite plugin)

The **recommended path** is the Vite plugin above. For scripts, CI, or other bundlers, call `buildIconFont` with the same defaults as the plugin (`outputDir` → `./public/zynora` from the current working directory, default font/class names, `fontsUrl` inferred when output sits under `public/`):

```js
import { buildIconFont } from "zynora";

// Package icons → ./public/zynora (default)
await buildIconFont();

// App-only icons (no package set)
await buildIconFont({
    packageIcons: false,
    inputDir: "./icons"
});
```

## Rebuilding in dev

The plugin watches **`*.svg`** and **`*.png`** under **this package’s `icons/`** and, when you set `input`, under your app’s icons folder as well. Changes in either tree trigger a rebuild. Full reload after a successful rebuild is on by default (`reloadOnChange`).
