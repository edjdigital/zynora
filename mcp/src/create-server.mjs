import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { filterIcons, getPayload } from "./icons-catalog.mjs";

const QUICKSTART_MARKDOWN = `# Zynora quick reference (for assistants)

Official docs: https://zynora.even7.dev/

## HTML

Use the family class \`zy\` plus the icon class (\`zys-*\` solid, \`zyb-*\` brands, or the prefix from each style's \`.zynora.yaml\`):

\`\`\`html
<i class="zy zys-star" aria-hidden="true"></i>
<i class="zy zyb-picpay" aria-hidden="true"></i>
\`\`\`

Import the virtual stylesheet once in Vite:

\`\`\`ts
import "zynora/css";
\`\`\`

## Vite plugin

\`\`\`ts
import { defineConfig } from "vite";
import { zynora } from "zynora/vite";

export default defineConfig({
    plugins: [zynora()]
});
\`\`\`

Icons live under \`icons/{style}/{name}/\` with \`icon.svg\` or \`icon.png\` and optional \`doc.md\` (trademark notice for brands).

## MCP catalog

Structured icon data (classes, code points, SVG previews) is published at **/zynora-icons.json** on the docs site after \`yarn doc:data\`.
`;

/**
 * Builds a new MCP server instance (one per stdio process or per HTTP session).
 *
 * @returns {McpServer}
 */
export function createZynoraMcpServer() {
    const server = new McpServer({
        name: "zynora",
        version: "1.0.0"
    });

    server.registerResource(
        "zynora-quickstart",
        "zynora://docs/quickstart",
        {
            title: "Zynora quick reference",
            description: "HTML, Vite, and folder conventions for Zynora icon fonts.",
            mimeType: "text/markdown"
        },
        async (uri) => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: "text/markdown",
                    text: QUICKSTART_MARKDOWN
                }
            ]
        })
    );

    server.registerTool(
        "zynora_search_icons",
        {
            title: "Search Zynora icons",
            description:
                "Search the Zynora icon catalog by slug, CSS class, or style. Returns HTML usage, code point, and optional SVG preview.",
            inputSchema: z.object({
                query: z
                    .string()
                    .optional()
                    .describe("Substring match against slug, classId, style, or htmlUsage (case-insensitive)."),
                style: z
                    .string()
                    .optional()
                    .describe('Icon style folder name, e.g. "solid" or "brands".'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(200)
                    .optional()
                    .default(25)
                    .describe("Maximum number of icons to return (1–200).")
            }),
            annotations: {
                readOnlyHint: true
            }
        },
        async ({ query, style, limit }) => {
            const payload = await getPayload();
            const matched = filterIcons(payload.icons, query, style, limit ?? 25);
            const slim = matched.map((i) => ({
                slug: i.slug,
                classId: i.classId,
                baseClass: i.baseClass,
                style: i.style,
                styleLabel: i.styleLabel,
                trademark: i.trademark,
                htmlUsage: i.htmlUsage,
                codepointHex: i.codepointHex,
                relativeSource: i.relativeSource,
                previewSvg: i.previewSvg ?? null,
                previewKind: i.previewKind ?? null
            }));

            const text = JSON.stringify(
                {
                    generatedAt: payload.generatedAt ?? null,
                    count: slim.length,
                    icons: slim
                },
                null,
                2
            );

            return {
                content: [{ type: "text", text }]
            };
        }
    );

    server.registerTool(
        "zynora_get_icon",
        {
            title: "Get one Zynora icon",
            description: "Look up a single icon by slug (folder name) or full CSS class id (e.g. zyb-picpay).",
            inputSchema: z
                .object({
                    slug: z.string().optional().describe('Icon folder name under icons/{style}/, e.g. "picpay".'),
                    classId: z
                        .string()
                        .optional()
                        .describe('Full icon class including prefix, e.g. "zyb-picpay".'),
                    style: z
                        .string()
                        .optional()
                        .describe('When using slug, optional style folder (e.g. "brands") to disambiguate duplicate slugs.')
                })
                .refine((v) => Boolean(v.slug?.trim()) || Boolean(v.classId?.trim()), {
                    message: "Provide slug or classId."
                }),
            annotations: {
                readOnlyHint: true
            }
        },
        async ({ slug, classId, style }) => {
            const payload = await getPayload();
            const s = slug?.trim().toLowerCase();
            const c = classId?.trim().toLowerCase();
            const st = style?.trim().toLowerCase();

            const icon = payload.icons.find((i) => {
                if (c && (i.classId ?? "").toLowerCase() === c) {
                    return true;
                }

                if (s && (i.slug ?? "").toLowerCase() === s) {
                    if (st && (i.style ?? "").toLowerCase() !== st) {
                        return false;
                    }

                    return true;
                }

                return false;
            });

            if (!icon) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ error: "not_found", slug: slug ?? null, classId: classId ?? null }, null, 2)
                        }
                    ],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: JSON.stringify(icon, null, 2) }]
            };
        }
    );

    server.registerTool(
        "zynora_list_styles",
        {
            title: "List Zynora icon styles",
            description: "Returns distinct style keys and labels from the current icon catalog.",
            inputSchema: z.object({}),
            annotations: {
                readOnlyHint: true
            }
        },
        async () => {
            const payload = await getPayload();
            const map = new Map();

            for (const i of payload.icons) {
                const key = i.style ?? "unknown";

                if (!map.has(key)) {
                    map.set(key, i.styleLabel ?? key);
                }
            }

            const styles = [...map.entries()].map(([style, styleLabel]) => ({ style, styleLabel }));
            const text = JSON.stringify({ generatedAt: payload.generatedAt ?? null, styles }, null, 2);

            return {
                content: [{ type: "text", text }]
            };
        }
    );

    return server;
}
