// Re-exported rather than reimplemented — Phase 6 already hand-rolled a
// sample-size/volatility confidence score (modules/intelligence/ml/stats.util.ts)
// and every domain AI service in Phase 7 needs the exact same shape of
// answer (Core Principle 3: every prediction must include a confidence
// score), so this is the one place that decides where it comes from.
export { confidenceScore } from "../../modules/intelligence/ml/stats.util";
