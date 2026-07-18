const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm workspace support: watch the monorepo root so changes in
// packages/* are picked up. pnpm links dependencies via symlinks into a
// content-addressed store rather than hoisting real files, so Metro needs
// symlink support *and* its normal hierarchical node_modules lookup left
// enabled — disabling it (as some Yarn/npm monorepo guides suggest) breaks
// resolution of a package's own nested deps inside pnpm's `.pnpm/*/node_modules`.
config.watchFolders = [workspaceRoot];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
