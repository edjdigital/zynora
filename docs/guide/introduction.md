# Introduction

**Zynora** is a small toolchain and icon set format for shipping **icon fonts** on the web. It is **created by the Even7 team**. You maintain **vector (or PNG) sources** in a predictable folder tree; the **Vite plugin** (or a programmatic API) turns them into **woff2 / woff / ttf**, a **CSS file**, and **JSON / TypeScript** codepoint maps.

## Why a font?

Icon fonts still work well when you want **one HTTP request**, **CSS-controlled size and color**, and **simple markup** (`<i>` with classes). Zynora keeps that model but adds:

- **Per-icon folders** so art and metadata stay together.
- **Style groups** (e.g. `solid` vs `brands`) with configurable **class prefixes** (`zys-*`, `zyb-*`, …).
- A **documentation site** (this site) generated from the same sources.

## What you will do

1. Add or edit files under `icons/{style}/{slug}/` (see [Icon folders & metadata](./icon-folders.md)).
2. Enable the **Vite plugin** in your app (see [Installation & usage](./installation-and-usage.md)).
3. Import the generated **CSS** and use the **two-class** pattern in HTML.

## Naming

- **Family class** (default `zy`) loads the font and base metrics.
- **Icon class** (e.g. `zys-star`, `zyb-picpay`) sets the glyph via `::before`.

Example:

```html
<i class="zy zys-star" aria-hidden="true"></i>
```

Next: [Installation & usage](./installation-and-usage.md).
