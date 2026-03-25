import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

/**
 * @typedef {object} ZynoraStyleConfig
 * @property {string} [classPrefix] - Short prefix for CSS icon classes in this style (e.g. `zyb` for brands).
 * @property {string} [label] - Human-readable style name for documentation.
 */

/**
 * @typedef {object} ZynoraIconDocMeta
 * @property {boolean | undefined} [trademark] - When set in `doc.md`, overrides default trademark hint for this icon.
 */

/**
 * @typedef {object} ZynoraIconEntry
 * @property {string} style - Style folder name (e.g. `brands`, `solid`).
 * @property {string} slug - Icon folder name (e.g. `picpay`).
 * @property {string} classId - Second CSS class segment (e.g. `zyb-picpay`). Usage: `zy ${classId}`.
 * @property {string} sourcePath - Absolute path to `icon.svg` or `icon.png`.
 * @property {string} relativeSource - Path relative to icons root.
 * @property {string | null} docPath - Absolute path to `doc.md` when present.
 * @property {ZynoraIconDocMeta} meta - Parsed frontmatter (trademark override only).
 * @property {boolean} trademark - Show trademark notice in docs (`true` for all `brands` by default unless overridden in `doc.md`).
 * @property {string} styleLabel - Label from style config or derived from folder name.
 */

const DOC_BASE_CLASS = "zy";

/**
 * Default `classPrefix` when `icons/{style}/.zynora.yaml` omits it.
 *
 * @param {string} style - Style directory name.
 * @returns {string}
 */
export function defaultClassPrefixForStyle(style) {
    if (style === "brands") {
        return "zyb";
    }

    if (style === "solid") {
        return "zys";
    }

    const cleaned = style.replace(/[^a-z0-9-]/gi, "").toLowerCase();

    return cleaned.length > 0 ? cleaned : "zyn";
}

/**
 * Loads optional `icons/{style}/.zynora.yaml`.
 *
 * @param {string} styleDir - Absolute path to the style folder.
 * @returns {Promise<ZynoraStyleConfig>}
 */
async function loadStyleConfig(styleDir) {
    const candidates = [path.join(styleDir, ".zynora.yaml"), path.join(styleDir, ".zynora.yml")];

    for (const filePath of candidates) {
        try {
            const raw = await readFile(filePath, "utf8");

            return YAML.parse(raw) ?? {};
        } catch (err) {
            if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
                continue;
            }

            throw err;
        }
    }

    return {};
}

/**
 * Coerces YAML `trademark` to boolean or leaves unset.
 *
 * @param {unknown} value - Raw frontmatter value.
 * @returns {boolean | undefined}
 */
function parseTrademarkField(value) {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (value === true) {
        return true;
    }

    if (value === false) {
        return false;
    }

    const s = String(value).toLowerCase();

    if (s === "true" || s === "yes" || s === "1") {
        return true;
    }

    if (s === "false" || s === "no" || s === "0") {
        return false;
    }

    return undefined;
}

/**
 * Parses optional `doc.md` YAML frontmatter for `trademark` only (other keys ignored).
 *
 * @param {string} filePath - Absolute path to `doc.md`.
 * @returns {Promise<{ meta: ZynoraIconDocMeta }>}
 */
export async function parseIconDocFile(filePath) {
    const raw = await readFile(filePath, "utf8");

    if (!raw.startsWith("---")) {
        return {
            meta: {}
        };
    }

    const end = raw.indexOf("\n---", 3);

    if (end === -1) {
        return {
            meta: {}
        };
    }

    const yamlBlock = raw.slice(3, end).trim();
    const data = YAML.parse(yamlBlock) ?? {};
    const trademark = parseTrademarkField(data.trademark);

    return {
        meta: {
            ...(trademark !== undefined ? { trademark } : {})
        }
    };
}

/**
 * Returns a title-case label from a slug.
 *
 * @param {string} slug - Folder slug.
 * @returns {string}
 */
function titleFromSlug(slug) {
    return slug
        .split(/[-_]/g)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

/**
 * Resolves `icon.svg` or `icon.png` inside an icon directory.
 *
 * @param {string} iconDir - Absolute path to `icons/{style}/{slug}`.
 * @returns {Promise<string | null>}
 */
async function resolveIconSourceInDir(iconDir) {
    const svgPath = path.join(iconDir, "icon.svg");

    try {
        const st = await stat(svgPath);

        if (st.isFile()) {
            return svgPath;
        }
    } catch (e) {
        if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ENOENT") {
            throw e;
        }
    }

    const pngPath = path.join(iconDir, "icon.png");

    try {
        const st2 = await stat(pngPath);

        if (st2.isFile()) {
            return pngPath;
        }
    } catch (e2) {
        if (!e2 || typeof e2 !== "object" || !("code" in e2) || e2.code !== "ENOENT") {
            throw e2;
        }
    }

    return null;
}

/**
 * Discovers icons under one `icons` root (single tree).
 *
 * @param {string} iconsRoot - Absolute path to an `icons` directory.
 * @returns {Promise<ZynoraIconEntry[]>}
 */
async function collectZynoraIconsFromSingleRoot(iconsRoot) {
    const root = path.resolve(iconsRoot);
    const entries = await readdir(root, { withFileTypes: true });
    const icons = [];

    for (const dirEnt of entries) {
        if (!dirEnt.isDirectory() || dirEnt.name.startsWith(".")) {
            continue;
        }

        const style = dirEnt.name;
        const styleDir = path.join(root, style);
        const styleConfig = await loadStyleConfig(styleDir);
        const classPrefix = styleConfig.classPrefix ?? defaultClassPrefixForStyle(style);
        const styleLabel = styleConfig.label ?? titleFromSlug(style);
        const childDirs = await readdir(styleDir, { withFileTypes: true });

        for (const child of childDirs) {
            if (!child.isDirectory() || child.name.startsWith(".")) {
                continue;
            }

            const slug = child.name;
            const iconDir = path.join(styleDir, slug);
            const sourcePath = await resolveIconSourceInDir(iconDir);

            if (!sourcePath) {
                continue;
            }

            const docPathJoined = path.join(iconDir, "doc.md");
            let docPath = null;
            let meta = {};

            try {
                const st = await stat(docPathJoined);

                if (st.isFile()) {
                    docPath = docPathJoined;
                    const parsed = await parseIconDocFile(docPathJoined);
                    meta = parsed.meta;
                }
            } catch (e3) {
                if (!e3 || typeof e3 !== "object" || !("code" in e3) || e3.code !== "ENOENT") {
                    throw e3;
                }
            }

            const classId = `${classPrefix}-${slug}`;

            // Brand-style folders default to trademark notice (Font Awesome–style); override with doc.md `trademark: false`.
            let trademark = style === "brands";

            if (docPath && meta.trademark !== undefined) {
                trademark = meta.trademark;
            }

            icons.push({
                style,
                slug,
                classId,
                sourcePath,
                relativeSource: path.relative(root, sourcePath),
                docPath,
                meta,
                trademark,
                styleLabel,
                baseClass: DOC_BASE_CLASS
            });
        }
    }

    return icons.sort((a, b) => {
        if (a.style !== b.style) {
            return a.style.localeCompare(b.style);
        }

        return a.slug.localeCompare(b.slug);
    });
}

/**
 * Discovers all Zynora icons under a single `icons` root.
 *
 * @param {string} iconsRoot - Path to an `icons` directory.
 * @returns {Promise<ZynoraIconEntry[]>}
 */
export async function collectZynoraIcons(iconsRoot) {
    return collectZynoraIconsFromSingleRoot(iconsRoot);
}

/**
 * Merges icons from several roots; later roots override the same `{style}/{slug}` key.
 *
 * @param {string[]} roots - Absolute or relative `icons` directory paths (deduped).
 * @returns {Promise<ZynoraIconEntry[]>}
 */
export async function collectMergedZynoraIconRoots(roots) {
    const seen = new Set();
    const ordered = [];

    for (const r of roots) {
        const abs = path.resolve(r);

        if (seen.has(abs)) {
            continue;
        }

        seen.add(abs);
        ordered.push(abs);
    }

    const byKey = new Map();

    for (const root of ordered) {
        const batch = await collectZynoraIconsFromSingleRoot(root);

        for (const icon of batch) {
            const key = `${icon.style}/${icon.slug}`;
            byKey.set(key, icon);
        }
    }

    const merged = [...byKey.values()];

    merged.sort((a, b) => {
        if (a.style !== b.style) {
            return a.style.localeCompare(b.style);
        }

        return a.slug.localeCompare(b.slug);
    });

    return merged;
}

/**
 * Builds a map used by fantasticon `getIconId`: staging relative path without extension → public class id.
 *
 * @param {ZynoraIconEntry[]} icons - Collected icons.
 * @returns {Map<string, string>}
 */
export function buildStagingPathToClassIdMap(icons) {
    const map = new Map();

    for (const icon of icons) {
        const key = `${icon.style}/${icon.slug}`;
        map.set(key, icon.classId);
    }

    return map;
}

/**
 * Resolves `getIconId` for fantasticon from a staging path map.
 *
 * @param {Map<string, string>} stagingPathToClassId - Map from `style/slug` to `classId`.
 * @param {{ relativeFilePath: string }} opts - Fantasticon callback argument.
 * @returns {string}
 */
export function resolveStagingIconId(stagingPathToClassId, opts) {
    const norm = opts.relativeFilePath.replace(/\\/g, "/").replace(/\.(svg|png)$/i, "");
    const hit = stagingPathToClassId.get(norm);

    if (hit) {
        return hit;
    }

    return norm.replace(/\//g, "-");
}
