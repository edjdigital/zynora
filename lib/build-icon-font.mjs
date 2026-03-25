import { FontAssetType, generateFonts, OtherAssetType } from "fantasticon";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import {
    buildStagingPathToClassIdMap,
    collectMergedZynoraIconRoots,
    resolveStagingIconId
} from "./collect-icons.mjs";
import { ZYNORA_PACKAGE_ICONS_DIR } from "./paths.mjs";

const require = createRequire(import.meta.url);
const potrace = require("potrace");
const tracePng = promisify(potrace.trace);

/**
 * If `outputDir` is inside a `public` folder, returns a URL prefix for `@font-face` (e.g. `/zynora/`).
 *
 * @param {string} outputDir - Absolute output directory.
 * @returns {string | null}
 */
function inferFontsUrlFromOutputDir(outputDir) {
    const parts = outputDir.split(path.sep);
    let publicIdx = -1;

    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === "public") {
            publicIdx = i;
        }
    }

    if (publicIdx === -1 || publicIdx === parts.length - 1) {
        return null;
    }

    const rel = parts.slice(publicIdx + 1).join("/");

    return `/${rel}/`.replace(/\/{2,}/g, "/");
}

/**
 * Normalizes fantasticon `codepoints` to a plain record of decimal code points.
 *
 * @param {unknown} codepoints - Fantasticon codepoints map.
 * @returns {Record<string, number>}
 */
function codepointsToRecord(codepoints) {
    if (!codepoints) {
        return {};
    }

    if (codepoints instanceof Map) {
        return Object.fromEntries(codepoints);
    }

    if (typeof codepoints === "object") {
        return /** @type {Record<string, number>} */ (codepoints);
    }

    return {};
}

/**
 * Formats a Unicode code point as a CSS `content` escape (no quotes inside the escape).
 *
 * @param {number} cp - Unicode scalar value.
 * @returns {string}
 */
function codepointToCssEscape(cp) {
    const hex = cp.toString(16).toLowerCase();

    if (hex.length <= 4) {
        return hex.padStart(4, "0");
    }

    return hex;
}

/**
 * Writes a Font Awesome–like stylesheet: base `.{baseClass}` + `.{baseClass}.{classId}::before` rules.
 *
 * @param {object} opts - Output options.
 * @param {string} opts.outputDir - Font output directory.
 * @param {string} opts.fontName - File base name and `font-family` name.
 * @param {string | null} opts.fontsUrl - Public URL prefix for font files, or null for relative `./`.
 * @param {Record<string, number>} opts.codepoints - Icon id → decimal code point.
 * @param {string} opts.baseClass - Family class (e.g. `zy`).
 * @returns {Promise<void>}
 */
async function writeZynoraIconStylesheet(opts) {
    const { outputDir, fontName, fontsUrl, codepoints, baseClass } = opts;
    const urlBase = fontsUrl === null || fontsUrl === undefined || fontsUrl === ""
        ? "./"
        : (fontsUrl.endsWith("/") ? fontsUrl : `${fontsUrl}/`);
    const faceSrc = [
        `url("${urlBase}${fontName}.woff2") format("woff2")`,
        `url("${urlBase}${fontName}.woff") format("woff")`,
        `url("${urlBase}${fontName}.ttf") format("truetype")`
    ].join(",\n       ");
    const lines = [];

    lines.push(`@font-face {`);
    lines.push(`  font-family: "${fontName}";`);
    lines.push(`  font-style: normal;`);
    lines.push(`  font-weight: 400;`);
    lines.push(`  font-display: block;`);
    lines.push(`  src: ${faceSrc};`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`.${baseClass} {`);
    lines.push(`  -moz-osx-font-smoothing: grayscale;`);
    lines.push(`  -webkit-font-smoothing: antialiased;`);
    lines.push(`  display: inline-block;`);
    lines.push(`  font-style: normal;`);
    lines.push(`  font-variant: normal;`);
    lines.push(`  font-weight: normal;`);
    lines.push(`  line-height: 1;`);
    lines.push(`  font-family: "${fontName}" !important;`);
    lines.push(`  text-rendering: auto;`);
    lines.push(`}`);
    lines.push(``);

    const entries = Object.entries(codepoints).sort(([a], [b]) => a.localeCompare(b));

    for (const [classId, rawCp] of entries) {
        const cp = typeof rawCp === "number" ? rawCp : Number(rawCp);
        const hex = codepointToCssEscape(cp);

        lines.push(`.${baseClass}.${classId}::before {`);
        lines.push(`  content: "\\${hex}";`);
        lines.push(`}`);
    }

    await writeFile(path.join(outputDir, `${fontName}.css`), `${lines.join("\n")}\n`, "utf8");
}

/**
 * Copies or traces one icon into the staging tree as `{style}/{slug}.svg`.
 *
 * @param {import("./collect-icons.mjs").ZynoraIconEntry} icon - Collected icon entry.
 * @param {string} stagingDir - Staging root directory.
 * @returns {Promise<void>}
 */
async function stageCollectedIcon(icon, stagingDir) {
    const dest = path.join(stagingDir, icon.style, `${icon.slug}.svg`);
    await mkdir(path.dirname(dest), { recursive: true });
    const ext = path.extname(icon.sourcePath).toLowerCase();

    if (ext === ".svg") {
        await cp(icon.sourcePath, dest);

        return;
    }

    const svg = await tracePng(icon.sourcePath);
    await writeFile(dest, svg, "utf8");
}

/**
 * Resolves icon roots from options (package + optional extra `inputDir`).
 *
 * @param {object} opts - Options slice.
 * @param {boolean} opts.packageIcons - Include built-in package `icons/`.
 * @param {string | undefined} opts.inputDir - Extra icons directory (absolute).
 * @returns {string[]}
 */
function resolveIconRoots(opts) {
    const { packageIcons, inputDir } = opts;
    const set = new Set();

    if (packageIcons) {
        set.add(path.resolve(ZYNORA_PACKAGE_ICONS_DIR));
    }

    if (inputDir) {
        set.add(path.resolve(inputDir));
    }

    return [...set];
}

/**
 * Builds an icon font kit from one or merged `icons/` trees (package + optional app folder).
 *
 * Defaults match the Vite plugin: `outputDir` → `./public/zynora` (from `process.cwd()`), `fontName` → `zynora`,
 * `baseClass` → `zy`, `fontsUrl` inferred when `outputDir` lies under a `public` segment.
 *
 * @param {object} [options={}] - Build options.
 * @param {boolean} [options.packageIcons=true] - Include icons from the `zynora` package. Set `false` to use only `inputDir`.
 * @param {string} [options.inputDir] - Additional icons root (merged after package icons; same `{style}/{slug}` overrides the package).
 * @param {string} [options.outputDir] - Output directory (default: `public/zynora` relative to `process.cwd()`).
 * @param {string} [options.fontName="zynora"] - Font / file base name.
 * @param {string} [options.baseClass="zy"] - CSS family class.
 * @param {string | null} [options.fontsUrl] - `@font-face` URL prefix; if omitted, inferred from `outputDir` when under `public/`.
 * @param {number} [options.fontHeight=300] - Normalized font height for fantasticon.
 * @returns {Promise<object>} Fantasticon result summary plus `icons` and `codepoints`.
 */
export async function buildIconFont(options = {}) {
    const cwd = process.cwd();
    const packageIcons = options.packageIcons !== false;
    const inputDir = options.inputDir !== undefined && options.inputDir !== null && String(options.inputDir).trim() !== ""
        ? path.resolve(options.inputDir)
        : undefined;
    const outputDir = path.resolve(options.outputDir ?? path.join(cwd, "public", "zynora"));
    const fontName = options.fontName ?? "zynora";
    const baseClass = options.baseClass ?? "zy";
    const fontHeight = options.fontHeight ?? 300;

    let fontsUrl;

    if (options.fontsUrl !== undefined) {
        fontsUrl = options.fontsUrl;
    } else {
        fontsUrl = inferFontsUrlFromOutputDir(outputDir);
    }

    const roots = resolveIconRoots({
        packageIcons,
        inputDir
    });

    if (roots.length === 0) {
        throw new Error(
            "buildIconFont: no icon roots. Set packageIcons: true (default) or pass inputDir, or both."
        );
    }

    const icons = await collectMergedZynoraIconRoots(roots);

    if (icons.length === 0) {
        throw new Error(
            `No Zynora icons found in roots: ${roots.join(", ")}. Expected icons/{style}/{slug}/icon.svg (or icon.png).`
        );
    }

    const stagingRoot = await mkdtemp(path.join(tmpdir(), "zynora-staging-"));
    const stagingPathToClassId = buildStagingPathToClassIdMap(icons);

    try {
        for (const icon of icons) {
            await stageCollectedIcon(icon, stagingRoot);
        }

        await mkdir(outputDir, { recursive: true });

        const results = await generateFonts({
            inputDir: stagingRoot,
            outputDir,
            name: fontName,
            fontTypes: [FontAssetType.WOFF2, FontAssetType.WOFF, FontAssetType.TTF],
            assetTypes: [OtherAssetType.JSON, OtherAssetType.TS],
            fontHeight,
            normalize: true,
            prefix: "",
            tag: "i",
            ...(fontsUrl !== null && fontsUrl !== undefined && fontsUrl !== ""
                ? { fontsUrl }
                : {}),
            formatOptions: {
                json: {
                    indent: 2
                }
            },
            getIconId: (opts) => resolveStagingIconId(stagingPathToClassId, opts)
        });

        const codepoints = codepointsToRecord(results.codepoints);

        await writeZynoraIconStylesheet({
            outputDir,
            fontName,
            fontsUrl,
            codepoints,
            baseClass
        });

        return {
            ...results,
            icons,
            codepoints
        };
    } finally {
        await rm(stagingRoot, { recursive: true, force: true });
    }
}
