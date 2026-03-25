#!/usr/bin/env node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIconFont } from "../lib/build-icon-font.mjs";
import { collectZynoraIcons } from "../lib/collect-icons.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(PACKAGE_ROOT, "icons");
const DATA_DIR = path.join(PACKAGE_ROOT, "docs", ".vitepress", "data");
const DATA_FILE = path.join(DATA_DIR, "icons.json");

/**
 * Formats a decimal code point as `U+XXXX` for display.
 *
 * @param {number} cp - Code point.
 * @returns {string}
 */
function formatCodepointLabel(cp) {
    return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Lowercase hex glyph id (Font Awesome–style, e.g. `e43a`).
 *
 * @param {number} cp - Code point.
 * @returns {string}
 */
function formatCodepointGlyph(cp) {
    return cp.toString(16).toLowerCase();
}

/**
 * Loads SVG markup or marks PNG sources.
 *
 * @param {string} filePath - Absolute path to icon source.
 * @returns {Promise<{ kind: "svg" | "png"; markup: string | null }>}
 */
async function loadPreviewMarkup(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".png") {
        return {
            kind: "png",
            markup: null
        };
    }

    const raw = await readFile(filePath, "utf8");

    return {
        kind: "svg",
        markup: raw.trim()
    };
}

/**
 * Builds serializable icon records for the VitePress gallery.
 *
 * @param {Awaited<ReturnType<typeof collectZynoraIcons>>} icons - Collected icons.
 * @param {Record<string, number>} codepoints - Icon class id → code point.
 * @returns {Promise<object[]>}
 */
async function buildIconRecords(icons, codepoints) {
    const records = [];

    for (const icon of icons) {
        const preview = await loadPreviewMarkup(icon.sourcePath);
        const cp = codepoints[icon.classId];
        const hasCp = typeof cp === "number" && Number.isFinite(cp);
        const usage = `<i class="${icon.baseClass} ${icon.classId}" aria-hidden="true"></i>`;

        records.push({
            baseClass: icon.baseClass,
            style: icon.style,
            styleLabel: icon.styleLabel,
            slug: icon.slug,
            classId: icon.classId,
            trademark: Boolean(icon.trademark),
            htmlUsage: usage,
            codepointHex: hasCp ? formatCodepointLabel(cp) : null,
            codepointGlyph: hasCp ? formatCodepointGlyph(cp) : null,
            codepointDecimal: hasCp ? cp : null,
            previewKind: preview.kind,
            previewSvg: preview.markup,
            relativeSource: icon.relativeSource
        });
    }

    return records;
}

/**
 * Writes `docs/.vitepress/data/icons.json` for the VitePress icon gallery.
 *
 * @returns {Promise<void>}
 */
async function main() {
    const icons = await collectZynoraIcons(ICONS_DIR);

    if (icons.length === 0) {
        await mkdir(DATA_DIR, { recursive: true });
        await writeFile(
            DATA_FILE,
            `${JSON.stringify({ generatedAt: new Date().toISOString(), icons: [] }, null, 2)}\n`,
            "utf8"
        );
        console.info(`No icons found; wrote empty ${path.relative(PACKAGE_ROOT, DATA_FILE)}`);

        return;
    }

    const tmpOut = await mkdtemp(path.join(tmpdir(), "zynora-icon-data-"));

    try {
        const { codepoints, icons: builtIcons } = await buildIconFont({
            outputDir: tmpOut,
            packageIcons: true,
            fontsUrl: null
        });

        const iconRecords = await buildIconRecords(builtIcons, codepoints);
        const payload = {
            generatedAt: new Date().toISOString(),
            icons: iconRecords
        };

        await mkdir(DATA_DIR, { recursive: true });
        await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        console.info(`Wrote ${iconRecords.length} icon(s) → ${path.relative(PACKAGE_ROOT, DATA_FILE)}`);
    } finally {
        await rm(tmpOut, {
            recursive: true,
            force: true
        });
    }
}

await main();
