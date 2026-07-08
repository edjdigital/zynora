import path from "node:path";

/**
 * Default output directory for the generated font kit under `node_modules/.cache/zynora`.
 *
 * @param baseDir Vite `root` or `process.cwd()`.
 * @returns Absolute path to the cache directory.
 */
export function resolveDefaultZynoraOutputDir(baseDir: string): string {
    return path.join(path.resolve(baseDir), "node_modules", ".cache", "zynora");
}
