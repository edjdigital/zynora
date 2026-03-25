import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the `zynora` package root (directory that contains `icons/`).
 */
export const ZYNORA_PACKAGE_ROOT = path.join(__dirname, "..");

/**
 * Built-in icon sources shipped with the package (`icons/{style}/{slug}/`).
 */
export const ZYNORA_PACKAGE_ICONS_DIR = path.join(ZYNORA_PACKAGE_ROOT, "icons");

/**
 * Default output directory for the generated font kit: under `node_modules/.cache/` so artifacts never land in `src/` or `public/`.
 * Served in dev via the virtual CSS module and `/@zynora/*`; emitted into `dist/zynora/` on production build when outside `publicDir`.
 *
 * @param {string} baseDir - Vite `root` or `process.cwd()`.
 * @returns {string} Absolute path.
 */
export function resolveDefaultZynoraOutputDir(baseDir) {
    return path.join(path.resolve(baseDir), "node_modules", ".cache", "zynora");
}
