import type { PredictionRequest, PredictionResult } from "./ai-brain.interfaces";

/**
 * Provider-agnostic forecasting contract — mirrors the LlmProvider /
 * EmbeddingProvider / VectorProvider pattern in intelligence/llm/ (Phase
 * 7/11): callers depend on this interface only, never on the concrete
 * implementation. `PredictionEngineService` is Phase 9's default
 * implementation — trailing-window linear-trend statistics over real
 * Prisma data, deliberately NOT a trained model (see ROADMAP.md's Phase 9
 * "AI design principles" note: "do not create fake AI"). A future phase
 * can register a real ML-backed PredictionProvider under the same
 * PREDICTION_PROVIDER_TOKEN without any caller (ReasoningEngineService,
 * DecisionEngineService, the controller) changing.
 */
export interface PredictionProvider {
  readonly name: string;
  predict(request: PredictionRequest): Promise<PredictionResult>;
}

export const PREDICTION_PROVIDER_TOKEN = "PREDICTION_PROVIDER_TOKEN";
