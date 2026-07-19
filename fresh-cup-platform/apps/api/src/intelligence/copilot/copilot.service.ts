import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../common/types/request-user.interface";
import { CoordinatorAgentService } from "../agents/coordinator-agent.service";
import { DecisionEngineService } from "../decision-engine/decision-engine.service";
import { ForecastingFacadeService } from "../forecasting/forecasting-facade.service";
import { ExplanationService } from "../services/explanation.service";
import type { CopilotRecommendation, CopilotResponse, CopilotStep } from "./copilot.types";

/**
 * The Executive Copilot — Phase 11 Part 3's natural-language surface that
 * makes its multi-step reasoning visible rather than jumping straight
 * from question to answer. Every step reuses existing services (nothing
 * here recomputes a number another service already owns):
 *   collect        -> CoordinatorAgentService routes to the relevant
 *                      specialized agents and gathers their insights
 *   analyze/compare-> DecisionEngineService's week-over-week comparison
 *                      (null if nothing significant changed)
 *   forecast       -> ForecastingFacadeService's revenue prediction
 *   explain        -> ExplanationService turns the gathered numbers into
 *                      prose (LLM-backed when configured, template
 *                      fallback otherwise — same as every other domain)
 *   recommend      -> the decision engine's action plan when one exists,
 *                      otherwise the routed agents' lowest-confidence
 *                      insights re-framed as "worth a closer look"
 * This is deliberately not a single LLM call — the steps are always run
 * and always return real data, whether or not LLM_PROVIDER is configured.
 * The optional `onStep` callback fires the moment each step actually
 * finishes — `CopilotGateway` uses it for real step-by-step WebSocket
 * streaming (not token-level LLM streaming, which no `LlmProvider`
 * implementation in this platform exposes yet).
 */
@Injectable()
export class CopilotService {
  constructor(
    private readonly coordinator: CoordinatorAgentService,
    private readonly decisionEngine: DecisionEngineService,
    private readonly forecasting: ForecastingFacadeService,
    private readonly explanation: ExplanationService,
  ) {}

  async ask(
    actor: RequestUser,
    question: string,
    branchId?: string,
    onStep?: (step: CopilotStep) => void,
  ): Promise<CopilotResponse> {
    const steps: CopilotStep[] = [];
    const pushStep = (step: CopilotStep) => {
      steps.push(step);
      onStep?.(step);
    };

    let started = Date.now();
    const coordinatorResult = await this.coordinator.ask(actor, question, branchId);
    pushStep({
      step: "collect",
      label: "Collect data from the relevant specialized agents",
      tookMs: Date.now() - started,
      summary: `Routed to: ${coordinatorResult.routedAgents.join(", ")}.`,
    });

    started = Date.now();
    const decisionReport = await this.decisionEngine.detectSalesDrop(actor, branchId, false);
    pushStep({
      step: "analyze_compare",
      label: "Analyze and compare this week to last week",
      tookMs: Date.now() - started,
      summary: decisionReport
        ? `Revenue changed ${decisionReport.changePercent}% week-over-week.`
        : "No significant week-over-week revenue change detected.",
    });

    started = Date.now();
    const forecast = await this.forecasting.revenue(branchId);
    pushStep({
      step: "forecast",
      label: "Forecast the next period",
      tookMs: Date.now() - started,
      summary: `Predicted next-period revenue: ${forecast.prediction} ETB (${Math.round(forecast.confidence * 100)}% confidence).`,
    });

    started = Date.now();
    const explanationText = await this.explanation.explain("Executive briefing", {
      question,
      routedAgents: coordinatorResult.routedAgents,
      revenueChangePercent: decisionReport?.changePercent ?? 0,
      forecastEtb: forecast.prediction,
    });
    pushStep({
      step: "explain",
      label: "Generate a plain-language explanation",
      tookMs: Date.now() - started,
      summary: explanationText,
    });

    started = Date.now();
    const recommendations = this.buildRecommendations(coordinatorResult, decisionReport);
    pushStep({
      step: "recommend",
      label: "Recommend actions",
      tookMs: Date.now() - started,
      summary: `${recommendations.length} recommendation(s).`,
    });

    const confidence =
      (coordinatorResult.confidence + forecast.confidence + (decisionReport ? 0.6 : 0.5)) / 3;

    return {
      question,
      branchId,
      steps,
      agentAnswers: coordinatorResult.answers,
      decisionReport,
      forecast,
      explanation: explanationText || coordinatorResult.synthesis,
      recommendations,
      confidence,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildRecommendations(
    coordinatorResult: Awaited<ReturnType<CoordinatorAgentService["ask"]>>,
    decisionReport: Awaited<ReturnType<DecisionEngineService["detectSalesDrop"]>>,
  ): CopilotRecommendation[] {
    if (decisionReport) {
      return decisionReport.recommendations.map((r) => ({
        action: r.action,
        expectedImpactEtb: r.expectedImpactEtb,
        confidence: r.confidence,
      }));
    }

    const allInsights = coordinatorResult.answers.flatMap((a) => a.insights);
    return allInsights
      .slice()
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 3)
      .map((insight) => ({
        action: `Worth a closer look — ${insight.title}: ${insight.explanation}`,
        confidence: insight.confidence,
      }));
  }
}
