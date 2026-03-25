import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { buildIconFont } from "./build-icon-font.mjs";
import { ZYNORA_PACKAGE_ICONS_DIR } from "./paths.mjs";

/**
 * URL prefix served by {@link createZynoraFontDevMiddleware} when font files are outside `publicDir`.
 */
const ZYNORA_DEV_FONT_PREFIX = "/@zynora/";

/**
 * MIME types for icon font binaries (dev / preview middleware).
 */
const FONT_MIME = {
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf"
};

/**
 * Virtual module id for `import "zynora/css"` (must end with `.css` for Vite’s CSS pipeline).
 */
const VIRTUAL_CSS_ID = "\0virtual:zynora.css";

/**
 * File path segment used in `package.json` exports for `zynora/css` resolution fallback.
 */
const CSS_ENTRY_BASENAME = "zynora-css-entry.mjs";

/**
 * Returns true when `filePath` is `rootDir` or a path inside it.
 *
 * @param {string} rootDir - Absolute directory root.
 * @param {string} filePath - Absolute file path from the watcher.
 * @returns {boolean}
 */
function isPathInsideDir(rootDir, filePath) {
    const rel = path.relative(rootDir, filePath);

    if (rel === "") {
        return true;
    }

    return !path.isAbsolute(rel) && !rel.startsWith(`..${path.sep}`) && rel !== "..";
}

/**
 * If `outputDir` sits under Vite's public directory, returns a URL prefix for `@font-face` (e.g. `/zynora/`).
 *
 * @param {string} publicDir - Absolute Vite public directory.
 * @param {string} outputDir - Absolute output directory for generated assets.
 * @returns {string | null}
 */
function inferFontsUrlFromPublicDir(publicDir, outputDir) {
    const rel = path.relative(publicDir, outputDir);

    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
        return null;
    }

    const slug = rel.split(path.sep).join("/");

    return `/${slug}/`.replace(/\/{2,}/g, "/");
}

/**
 * Returns a debounced function that invokes `fn` after `ms` quiet period.
 *
 * @param {() => void | Promise<void>} fn - Callback to debounce.
 * @param {number} ms - Delay in milliseconds.
 * @returns {() => void}
 */
function debounce(fn, ms) {
    let timeoutId = null;

    return () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            fn();
        }, ms);
    };
}

/**
 * Builds the browser URL for a file that lives under Vite's `publicDir` (relative path uses POSIX `/`).
 *
 * @param {string} viteBase - `config.base` (e.g. `/`, `/admin/`, `./`).
 * @param {string} posixUnderPublic - Path under public root, e.g. `zynora/zynora.woff2`.
 * @returns {string}
 */
function urlForPublicFile(viteBase, posixUnderPublic) {
    const rel = posixUnderPublic.replace(/^\/+/, "");

    if (viteBase === "/" || viteBase === "") {
        return `/${rel}`;
    }

    if (viteBase === "./" || viteBase === ".") {
        // Root-absolute path: relative `url(./file.woff2)` is resolved against the virtual CSS
        // module and triggers Vite/Rolldown "didn't resolve at build time" warnings. Vite rewrites
        // root-relative `url(/...)` in emitted CSS when `base` is not `/`.
        return `/${rel}`;
    }

    const base = viteBase.endsWith("/") ? viteBase.slice(0, -1) : viteBase;

    return `${base}/${rel}`;
}

/**
 * Resolves the `url("...")` value for a generated font file so the virtual CSS module does not rely on Vite resolving relative URLs.
 *
 * @param {string} viteBase - `config.base`.
 * @param {string} publicDir - Absolute Vite `publicDir`.
 * @param {string} resolvedOutput - Absolute font kit output directory.
 * @param {string} basename - File name only, e.g. `zynora.woff2`.
 * @returns {string}
 */
function fontUrlForZynoraAsset(viteBase, publicDir, resolvedOutput, basename) {
    const absFont = path.join(resolvedOutput, basename);
    const relToPublic = path.relative(publicDir, absFont);

    if (!relToPublic.startsWith("..") && !path.isAbsolute(relToPublic)) {
        return urlForPublicFile(viteBase, relToPublic.split(path.sep).join("/"));
    }

    return `${ZYNORA_DEV_FONT_PREFIX}${basename}`;
}

/**
 * Escapes a string for use inside a `RegExp` constructor.
 *
 * @param {string} s - Raw segment.
 * @returns {string}
 */
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrites every `url("./{fontName}.ext")` (and quote variants) so Vite does not treat font files
 * as unresolved imports from the virtual CSS module.
 *
 * @param {string} css - Generated stylesheet text.
 * @param {object} ctx - Rewrite context.
 * @param {string} ctx.viteBase - `config.base`.
 * @param {string} ctx.publicDir - Absolute public directory.
 * @param {string} ctx.resolvedOutput - Absolute output directory.
 * @param {string} ctx.fontName - Font base file name (no extension).
 * @returns {string}
 */
function rewriteZynoraVirtualCssFontUrls(css, ctx) {
    const { viteBase, publicDir, resolvedOutput, fontName } = ctx;
    let out = css;

    for (const ext of ["woff2", "woff", "ttf"]) {
        const file = `${fontName}.${ext}`;
        const resolvedUrl = fontUrlForZynoraAsset(viteBase, publicDir, resolvedOutput, file);
        const esc = escapeRegExp(file);

        out = out.replace(
            new RegExp(`url\\(\\s*["']\\.\\/${esc}["']\\s*\\)`, "g"),
            `url("${resolvedUrl}")`
        );
        out = out.replace(
            new RegExp(`url\\(\\s*\\.\\/${esc}\\s*\\)`, "g"),
            `url("${resolvedUrl}")`
        );
    }

    return out;
}

/**
 * Replaces the `@font-face` `src:` block when URL patterns were not matched (e.g. custom `fontsUrl`).
 *
 * @param {string} css - Stylesheet text.
 * @param {object} ctx - Same as {@link rewriteZynoraVirtualCssFontUrls}.
 * @returns {string}
 */
function rewriteZynoraVirtualCssFontSrc(css, ctx) {
    const { viteBase, publicDir, resolvedOutput, fontName } = ctx;
    const parts = [
        `url("${fontUrlForZynoraAsset(viteBase, publicDir, resolvedOutput, `${fontName}.woff2`)}") format("woff2")`,
        `url("${fontUrlForZynoraAsset(viteBase, publicDir, resolvedOutput, `${fontName}.woff`)}") format("woff")`,
        `url("${fontUrlForZynoraAsset(viteBase, publicDir, resolvedOutput, `${fontName}.ttf`)}") format("truetype")`
    ];
    const newSrc = `  src: ${parts.join(",\n       ")};`;

    return css.replace(/^\s*src:\s*[\s\S]*?;/m, newSrc);
}

/**
 * Connect-style middleware: serves font files from `outputDir` at {@link ZYNORA_DEV_FONT_PREFIX}`{basename}`.
 *
 * @param {string} outputDir - Absolute kit directory.
 * @returns {(req: import("http").IncomingMessage, res: import("http").ServerResponse, next: import("connect").NextFunction) => void}
 */
function createZynoraFontDevMiddleware(outputDir) {
    const absOut = path.resolve(outputDir);

    return (req, res, next) => {
        const rawUrl = req.url ?? "";

        let pathname;

        try {
            pathname = new URL(rawUrl, "http://localhost").pathname;
        } catch {
            next();

            return;
        }

        if (!pathname.startsWith(ZYNORA_DEV_FONT_PREFIX)) {
            next();

            return;
        }

        const decoded = decodeURIComponent(pathname.slice(ZYNORA_DEV_FONT_PREFIX.length));
        const base = path.basename(decoded);

        if (base !== decoded || base.includes("..")) {
            next();

            return;
        }

        const ext = path.extname(base).toLowerCase();

        if (!FONT_MIME[ext]) {
            next();

            return;
        }

        const filePath = path.join(absOut, base);

        if (!filePath.startsWith(absOut)) {
            next();

            return;
        }

        stat(filePath)
            .then((st) => {
                if (!st.isFile()) {
                    next();

                    return;
                }

                res.statusCode = 200;
                res.setHeader("Content-Type", FONT_MIME[ext]);
                res.setHeader("Cache-Control", "no-cache");
                createReadStream(filePath).pipe(res);
            })
            .catch(() => {
                next();
            });
    };
}

/**
 * @typedef {object} ZynoraPluginUserOptions
 * @property {string} [input] - Extra icons root merged on top of package icons (same `{style}/{slug}` overrides the package).
 * @property {boolean} [packageIcons=true] - When `false`, only `input` is used (required in that case).
 * @property {string} [output] - Generated kit folder; default `public/zynora` (relative to Vite root).
 * @property {string | null} [fontsUrl] - `@font-face` URL prefix; inferred when `output` is under `publicDir` (omit for default).
 * @property {string} [fontName] - Base font / file name (default: `zynora`).
 * @property {string} [baseClass] - CSS family class (default: `zy`).
 * @property {number} [fontHeight] - Normalized icon height (default: `300`).
 * @property {boolean} [watch=true] - Rebuild when sources under watched icon roots change in dev.
 * @property {number} [watchDebounceMs=250] - Debounce for dev rebuilds (ms).
 * @property {boolean} [reloadOnChange=true] - Full reload after a successful dev rebuild.
 * @property {boolean} [silent=false] - Suppress `[zynora]` success logs.
 *
 * Virtual CSS does not get correct `url()` resolution for relative font paths; the plugin rewrites `@font-face` URLs (and can serve `/@zynora/*` in dev when output is outside `publicDir`).
 */

/**
 * Vite plugin for the **Zynora** icon set: built-in `icons/` plus optional app `input`; font kit emitted into your app.
 *
 * @param {ZynoraPluginUserOptions} [userOptions={}] - Optional overrides.
 * @returns {import("vite").Plugin}
 *
 * @example
 * import { defineConfig } from "vite";
 * import { zynora } from "zynora/vite";
 *
 * export default defineConfig({
 *     plugins: [zynora()]
 * });
 *
 * @example
 * // main.ts
 * import "zynora/css";
 */
export function zynora(userOptions = {}) {
    const watch = userOptions.watch ?? true;
    const watchDebounceMs = userOptions.watchDebounceMs ?? 250;
    const reloadOnChange = userOptions.reloadOnChange ?? true;
    const silent = userOptions.silent ?? false;
    const packageIcons = userOptions.packageIcons !== false;

    /** @type {string | undefined} */
    let resolvedExtraInput;

    /** @type {string | undefined} */
    let resolvedOutput;

    /** @type {string | null | undefined} */
    let resolvedFontsUrl;

    /** @type {string} */
    let resolvedFontName = "zynora";

    /** @type {string[]} */
    let watchRoots = [];

    /** @type {import("vite").ResolvedConfig | undefined} */
    let viteResolvedConfig;

    /** @type {string} */
    let resolvedAbsolutePublicDir = "";

    /** @type {boolean} */
    let warnedDevOnlyFontUrls = false;

    /**
     * Absolute path to the generated `zynora.css` (or custom `fontName.css`).
     *
     * @returns {string}
     */
    function getGeneratedCssPath() {
        return path.join(resolvedOutput ?? "", `${resolvedFontName}.css`);
    }

    /**
     * Returns true when `id` is the package CSS entry resolved from disk.
     *
     * @param {string} id - Module id from Vite.
     * @returns {boolean}
     */
    function isCssPackageEntry(id) {
        const norm = id.split(path.sep).join("/");

        return norm.endsWith(`/${CSS_ENTRY_BASENAME}`);
    }

    /**
     * Runs the icon font build.
     *
     * @returns {Promise<void>}
     */
    async function runBuild() {
        if (!resolvedOutput) {
            return;
        }

        await buildIconFont({
            packageIcons,
            inputDir: resolvedExtraInput,
            outputDir: resolvedOutput,
            fontName: userOptions.fontName,
            baseClass: userOptions.baseClass,
            fontsUrl: resolvedFontsUrl,
            fontHeight: userOptions.fontHeight
        });

        if (!silent) {
            console.info(`[zynora] icon font built → ${resolvedOutput}`);
        }
    }

    return {
        name: "zynora-icon-font",
        enforce: "pre",

        /**
         * @param {import("vite").ResolvedConfig} config - Resolved Vite configuration.
         * @returns {void}
         */
        configResolved(config) {
            viteResolvedConfig = config;
            const root = config.root;
            const publicDir = path.resolve(config.publicDir);

            resolvedAbsolutePublicDir = publicDir;

            if (!packageIcons && !userOptions.input) {
                throw new Error('[zynora] With `packageIcons: false` you must set `input` to your icons directory.');
            }

            resolvedExtraInput = userOptions.input
                ? (path.isAbsolute(userOptions.input)
                    ? userOptions.input
                    : path.resolve(root, userOptions.input))
                : undefined;

            resolvedOutput = userOptions.output
                ? (path.isAbsolute(userOptions.output)
                    ? userOptions.output
                    : path.resolve(root, userOptions.output))
                : path.resolve(root, "public", "zynora");

            if (userOptions.fontsUrl !== undefined) {
                resolvedFontsUrl = userOptions.fontsUrl === "" ? null : userOptions.fontsUrl;
            } else {
                resolvedFontsUrl = inferFontsUrlFromPublicDir(publicDir, resolvedOutput);
            }

            resolvedFontName = userOptions.fontName ?? "zynora";

            watchRoots = [];

            if (packageIcons) {
                watchRoots.push(ZYNORA_PACKAGE_ICONS_DIR);
            }

            if (resolvedExtraInput) {
                const absExtra = path.resolve(resolvedExtraInput);

                if (!watchRoots.some((w) => path.resolve(w) === absExtra)) {
                    watchRoots.push(absExtra);
                }
            }
        },

        /**
         * Maps `zynora/css` (and the package entry file) to a virtual `.css` module.
         *
         * @param {string} id - Requested module id.
         * @returns {string | undefined}
         */
        resolveId(id) {
            if (id === VIRTUAL_CSS_ID) {
                return VIRTUAL_CSS_ID;
            }

            if (id === "zynora/css" || id.endsWith("/zynora/css")) {
                return VIRTUAL_CSS_ID;
            }

            if (isCssPackageEntry(id)) {
                return VIRTUAL_CSS_ID;
            }

            return undefined;
        },

        /**
         * Serves generated icon font CSS through the virtual module.
         *
         * @param {string} id - Module id.
         * @returns {Promise<string | undefined>}
         */
        async load(id) {
            if (id !== VIRTUAL_CSS_ID) {
                return undefined;
            }

            if (!resolvedOutput) {
                throw new Error("[zynora] Cannot load virtual CSS before config is resolved.");
            }

            const cssPath = getGeneratedCssPath();

            try {
                const rawCss = await readFile(cssPath, "utf8");

                this.addWatchFile(cssPath);

                const viteBase = viteResolvedConfig?.base ?? "/";
                const rewriteCtx = {
                    viteBase,
                    publicDir: resolvedAbsolutePublicDir,
                    resolvedOutput: resolvedOutput ?? "",
                    fontName: resolvedFontName
                };
                let css = rewriteZynoraVirtualCssFontUrls(rawCss, rewriteCtx);
                const stillRelative = new RegExp(
                    `url\\(\\s*["']?\\.\\/${escapeRegExp(resolvedFontName)}\\.(?:woff2|woff|ttf)["']?\\s*\\)`
                ).test(css);

                if (stillRelative) {
                    css = rewriteZynoraVirtualCssFontSrc(css, rewriteCtx);
                }

                const usesDevPrefix = css.includes(ZYNORA_DEV_FONT_PREFIX);

                if (usesDevPrefix && viteResolvedConfig?.command === "build" && !warnedDevOnlyFontUrls) {
                    warnedDevOnlyFontUrls = true;
                    viteResolvedConfig.logger.warn(
                        "[zynora] Font kit is outside publicDir; `/@zynora/*` URLs work in dev/preview only. "
                            + "Point `output` under your Vite `publicDir` (default `public/zynora`) or set `fontsUrl`."
                    );
                }

                for (const ext of [".woff2", ".woff", ".ttf"]) {
                    const fp = path.join(resolvedOutput ?? "", `${resolvedFontName}${ext}`);

                    try {
                        await stat(fp);
                        this.addWatchFile(fp);
                    } catch {
                        // Font may be missing until first successful build; ignore.
                    }
                }

                return css;
            } catch (err) {
                const hint = err && typeof err === "object" && "code" in err && err.code === "ENOENT"
                    ? " Run a successful build (check that icons exist under the configured input folder)."
                    : "";

                throw new Error(`[zynora] Missing generated stylesheet at "${cssPath}".${hint}`);
            }
        },

        /**
         * @returns {Promise<void>}
         */
        async buildStart() {
            await runBuild();
        },

        /**
         * @param {import("vite").ViteDevServer} server - Vite dev server instance.
         * @returns {void}
         */
        configureServer(server) {
            server.middlewares.use(createZynoraFontDevMiddleware(resolvedOutput ?? ""));

            if (!watch || watchRoots.length === 0) {
                return;
            }

            const schedule = debounce(async () => {
                try {
                    await runBuild();

                    if (reloadOnChange) {
                        server.ws.send({
                            type: "full-reload",
                            path: "*"
                        });
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);

                    server.config.logger.error(`[zynora] ${message}`);
                }
            }, watchDebounceMs);

            for (const root of watchRoots) {
                server.watcher.add(root);
            }

            server.watcher.on("all", (event, filePath) => {
                if (!filePath) {
                    return;
                }

                const normalized = path.normalize(filePath);
                const insideAny = watchRoots.some((root) => isPathInsideDir(root, normalized));

                if (!insideAny) {
                    return;
                }

                if (!/\.(svg|png)$/i.test(normalized)) {
                    return;
                }

                if (event === "add" || event === "change" || event === "unlink") {
                    schedule();
                }
            });
        },

        /**
         * Serves `/@zynora/*` font files during `vite preview` when the kit is outside `publicDir`.
         *
         * @param {import("vite").PreviewServer} server - Vite preview server.
         * @returns {void}
         */
        configurePreviewServer(server) {
            server.middlewares.use(createZynoraFontDevMiddleware(resolvedOutput ?? ""));
        }
    };
}
