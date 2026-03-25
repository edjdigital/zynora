---
layout: home

hero:
  name: Zynora
  text: Icon font kit for the web
  tagline: Complete icon toolkit with SVG, font, and CSS support, built for modern design systems and developer workflows.

  actions:
    - theme: brand
      text: How to use
      link: /guide/installation-and-usage
    - theme: alt
      text: Browse icons
      link: /icons/gallery

features:
  - title: Vite-native workflow
    details: The zynora() plugin compiles your icon set into woff2, CSS, JSON, and TypeScript maps under public/ (or a path you choose).

  - title: Organised like a design system
    details: Each glyph lives in icons/{style}/{name}/ with optional doc.md for trademark notices on brand marks when needed.

  - title: Familiar markup
    details: Use a base family class with a prefixed icon class on the same element, e.g. class="zy zyb-picpay".

  - title: MCP for assistants
    details: Stdio or remote Streamable HTTP MCP, plus a public /zynora-icons.json catalog, help agents use Zynora from Cursor and similar clients. See the MCP guide in Getting started.
---
