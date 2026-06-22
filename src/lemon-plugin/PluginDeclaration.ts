/**
 * Minimal Lemon bundler plugin declaration shape (mirrors @lemon/bundler PluginDeclaration
 * without taking a runtime dependency on the bundler).
 */
export interface PluginDeclaration {
    /**
     * The plugin name.
     */
    name: string;

    /**
     * The export name to be used when loading the plugin module.
     */
    exportName?: string;

    /**
     * Loads the underlying Vite plugin module.
     *
     * @returns The imported plugin module.
     */
    loader?(): Promise<unknown>;

    /**
     * When true, the plugin is skipped for node platform builds.
     */
    browserOnly?: boolean;

    /**
     * Instantiates the Vite plugin with Lemon-specific defaults.
     *
     * @param pluginFactory The loaded plugin factory from {@link loader}.
     * @param options Lemon/Vite config options from the bundler.
     * @returns A Vite plugin instance.
     */
    handler?(pluginFactory: (options: Record<string, unknown>) => unknown, options: unknown): unknown;
}
