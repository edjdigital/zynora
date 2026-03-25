import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = path.join(__dirname, "..");
const DEFAULT_ICONS_URL = "https://zynora.even7.dev/zynora-icons.json";

/**
 * Resolves absolute path to the zynora package root (parent of \`mcp/\`).
 *
 * @returns {string}
 */
export function defaultZynoraPackageRoot() {
    return path.resolve(MCP_ROOT, "..");
}

/**
 * Loads \`icons.json\` payload: env \`ZYNORA_ICONS_JSON\`, then \`ZYNORA_PACKAGE_ROOT\` + docs path, then HTTP \`ZYNORA_ICONS_URL\` or default CDN URL.
 *
 * @returns {Promise<{ generatedAt?: string; icons: object[] }>}
 */
async function loadIconsPayload() {
    const explicit = process.env.ZYNORA_ICONS_JSON;

    if (explicit) {
        const raw = await readFile(explicit, "utf8");

        return JSON.parse(raw);
    }

    const pkgRoot = process.env.ZYNORA_PACKAGE_ROOT ?? defaultZynoraPackageRoot();
    const localFile = path.join(pkgRoot, "docs", ".vitepress", "data", "icons.json");

    try {
        const raw = await readFile(localFile, "utf8");

        return JSON.parse(raw);
    } catch {
        // Continue to remote fallback
    }

    const url = process.env.ZYNORA_ICONS_URL ?? DEFAULT_ICONS_URL;
    const res = await fetch(url, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!res.ok) {
        throw new Error(
            `Failed to load icon catalog from ${url} (${res.status}). Set ZYNORA_PACKAGE_ROOT or ZYNORA_ICONS_JSON to a local icons.json, or run "yarn doc:data" in the zynora repo.`
        );
    }

    return res.json();
}

let cachedPayload = null;

/**
 * @returns {Promise<{ generatedAt?: string; icons: object[] }>}
 */
export async function getPayload() {
    if (!cachedPayload) {
        cachedPayload = await loadIconsPayload();
    }

    if (!cachedPayload?.icons || !Array.isArray(cachedPayload.icons)) {
        throw new Error("Invalid icon catalog: expected { icons: [...] }");
    }

    return cachedPayload;
}

/**
 * @param {object[]} icons
 * @param {string} [q]
 * @param {string} [style]
 * @param {number} limit
 * @returns {object[]}
 */
export function filterIcons(icons, q, style, limit) {
    let list = icons;

    if (style?.trim()) {
        const s = style.trim().toLowerCase();

        list = list.filter((i) => (i.style ?? "").toLowerCase() === s);
    }

    if (q?.trim()) {
        const needle = q.trim().toLowerCase();

        list = list.filter((i) => {
            const hay = [
                i.slug,
                i.classId,
                i.style,
                i.styleLabel,
                i.htmlUsage
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return hay.includes(needle);
        });
    }

    return list.slice(0, Math.min(Math.max(limit, 1), 200));
}
