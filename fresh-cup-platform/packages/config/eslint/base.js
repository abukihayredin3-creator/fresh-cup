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
    // This is the *root* fallback config lint-staged runs from repo root, covering files
    // across every package — it deliberately doesn't register app-specific plugins (React
    // hooks, Expo, Nest, ...). Without this, `eslint --fix` treats any disable comment
    // targeting one of those rules as "unused" (since the rule isn't registered here) and
    // silently deletes it, even though it's load-bearing under the file's own app-level
    // config. Off here, not just defaulted, so a pre-commit pass never mutates intent it
    // can't see.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
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
      // Off, not just off-for-Nest: `eslint --fix` can't tell "only used as
      // a type" from "must stay a real import so reflect-metadata sees it,"
      // and this is the *root* fallback config lint-staged uses across every
      // package — including apps/api, where autofixing this exact rule once
      // silently broke constructor DI repo-wide. Not worth a style
      // preference with no functional upside.
      "@typescript-eslint/consistent-type-imports": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
