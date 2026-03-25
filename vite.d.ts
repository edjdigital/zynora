import type { Plugin } from "vite";

/**
 * Options for {@link zynora}. All fields are optional; defaults use this package’s `icons/` merged with optional `input`, output `public/zynora`.
 */
export type ZynoraPluginOptions = {
    /**
     * When `true` (default), include icons from this package’s `icons/` tree, merged with `input` when set (app wins on same `{style}/{slug}`).
     * When `false`, only `input` is used (required in that case).
     */
    packageIcons?: boolean;

    /**
     * Extra icons root (`{style}/{slug}/icon.svg`). Merged after package icons; same path keys override the package.
     */
    input?: string;

    /**
     * Output directory for generated fonts and CSS. Defaults to `public/zynora` (relative to Vite `root`).
     */
    output?: string;

    /**
     * Public URL prefix for `@font-face` in generated CSS. Inferred when `output` lies under Vite `publicDir`.
     */
    fontsUrl?: string | null;

    /**
     * Base font / file name (default: `zynora`).
     */
    fontName?: string;

    /**
     * CSS family class paired with each icon class (default: `zy`). Usage: `<i class="zy zys-star">`.
     */
    baseClass?: string;

    /**
     * Normalized icon height for fantasticon (default: `300`).
     */
    fontHeight?: number;

    /**
     * When `true` (default), rebuild on changes under `input` during dev.
     */
    watch?: boolean;

    /**
     * Debounce in ms for dev rebuilds (default: `250`).
     */
    watchDebounceMs?: number;

    /**
     * When `true` (default), full-reload after a dev rebuild.
     */
    reloadOnChange?: boolean;

    /**
     * When `true`, suppress `[zynora]` success logs.
     */
    silent?: boolean;
};

/**
 * Vite plugin for the Zynora icon set.
 *
 * Enables `import "zynora/css"` as a virtual module that exposes the generated icon font stylesheet.
 *
 * @param options - Optional overrides.
 * @returns Vite plugin instance.
 */
export function zynora(options?: ZynoraPluginOptions): Plugin;
