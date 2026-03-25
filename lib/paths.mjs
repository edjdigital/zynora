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
