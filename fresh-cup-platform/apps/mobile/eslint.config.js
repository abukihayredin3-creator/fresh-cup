const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", ".expo/**"],
  },
  {
    files: ["jest.setup.js"],
    languageOptions: { globals: globals.jest },
  },
]);
