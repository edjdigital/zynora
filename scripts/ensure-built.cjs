const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const tsconfigPath = path.join(root, "tsconfig.lemon-plugin.json");
const distMarker = path.join(root, "dist", "lemon-plugin", "index.js");

/**
 * Skips when install runs before sources are present (e.g. Docker layer cache with package.json only).
 *
 * @returns Nothing.
 */
if (!fs.existsSync(tsconfigPath)) {
    process.exit(0);
}

if (!fs.existsSync(distMarker)) {
    execSync("yarn build", {
        cwd: root,
        stdio: "inherit",
        env: process.env
    });
}
