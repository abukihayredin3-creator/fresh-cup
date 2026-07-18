// Root-level fallback so `eslint` has *a* config to resolve when invoked
// from this directory across files spanning multiple packages (this is
// what our pre-commit lint-staged hook does). Each package's own `pnpm
// lint` uses its more specific config (nestjs/react/expo variants) — this
// one only needs to cover the common denominator for a pre-commit --fix pass.
module.exports = require("@fresh-cup/config/eslint/base");
