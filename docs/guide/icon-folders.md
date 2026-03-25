# Icon folders & metadata

## Directory layout

```text
icons/
  solid/
    .zynora.yaml          # optional style config
    star/
      icon.svg            # required (or icon.png)
      doc.md              # optional - only `trademark` is read today
  brands/
    .zynora.yaml
    picpay/
      icon.svg
      doc.md
```

- **`{style}`** - Groups glyphs (like Font Awesome “solid” vs “brands”). Used in paths and filters in the gallery.
- **`{slug}`** - Folder name; shown in the gallery and detail header (lowercase, like Font Awesome). It also drives the CSS class with the style’s `classPrefix` (e.g. `zys-star`, `zyb-picpay`).

## Style config: `.zynora.yaml`

Place one next to the style folder’s children, e.g. `icons/brands/.zynora.yaml`.

| Field | Purpose |
| --- | --- |
| `classPrefix` | Short prefix for every icon in that style. If omitted: `brands` → `zyb`, `solid` → `zys`, otherwise derived from the folder name. |
| `label` | Label shown in the docs gallery filter (defaults to a title-cased style folder name). |

Example:

```yaml
classPrefix: zyb
label: Brands
```

## Optional `doc.md` (trademark only)

The gallery **does not** use `title`, `summary`, `description`, `tags`, or the markdown body anymore. The only frontmatter field that matters is:

| Field | Description |
| --- | --- |
| `trademark` | `true` or `false`. If omitted, **`icons/brands/...` defaults to `true`** (Font Awesome-style “may be protected as a trademark” banner). **`icons/solid/...` defaults to `false`**. |

Example - force the notice on a non-brand glyph:

```yaml
---
trademark: true
---
```

Example - hide the notice for a specific brand folder (only if you are sure it is appropriate):

```yaml
---
trademark: false
---
```

## Brand and legal notes

Do not commit **third-party logos** unless you have the right to distribute them. The trademark banner is a **reminder**, not legal advice.
