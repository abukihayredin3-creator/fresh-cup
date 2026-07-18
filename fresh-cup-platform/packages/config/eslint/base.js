// @ts-check
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

/** Shared ESLint flat config used as the base for every Fresh Cup app/package. */
module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/coverage/**",
    ],
  },
  {
    // CommonJS tooling config files (this file included) run directly under
    // Node, not the app's own runtime — they need `module`/`require` in scope,
    // and `require()` itself is the correct, idiomatic way to load them.
    // packages/config is entirely such tooling code, regardless of filename.
    files: ["**/*.config.js", "**/*.config.cjs", "eslint.config.js", "packages/config/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
