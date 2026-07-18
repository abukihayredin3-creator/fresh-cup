// @ts-check
const base = require("./base");

/** Shared ESLint flat config for the NestJS API. */
module.exports = [
  ...base,
  {
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // NestJS's constructor-injection DI reads runtime type metadata via
      // reflect-metadata, which requires a real (value) import even though
      // the symbol is only referenced in a type position — `import type`
      // would silently break injection.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
