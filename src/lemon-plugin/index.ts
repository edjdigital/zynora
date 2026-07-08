import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveDefaultZynoraOutputDir } from "./paths.js";

import type { PluginDeclaration } from "./PluginDeclaration.js";

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const vitePluginModuleUrl = pathToFileURL(path.join(packageRoot, "lib", "vite-plugin-zynora.mjs")).href;

/**
 * Lemon bundler plugin declaration for the Zynora icon font Vite plugin.
 */
const lemonPlugin: PluginDeclaration = {
    name: "zynora",
    exportName: "zynora",
    browserOnly: true,

    /**
     * Loads the Zynora Vite plugin from this package's lib directory.
     *
     * @returns The vite-plugin-zynora module.
     */
    async loader() {
        return import(vitePluginModuleUrl);
    },

    /**
     * Instantiates the Zynora plugin with Lemon bundler defaults.
     *
     * @param pluginFactory The `zynora` export from vite-plugin-zynora.
     * @returns A configured Vite plugin instance.
     */
    handler(pluginFactory: (options: { output: string; silent: boolean }) => unknown) {
        return pluginFactory({
            output: resolveDefaultZynoraOutputDir(process.cwd()),
            silent: true
        });
    }
};

export default lemonPlugin;
