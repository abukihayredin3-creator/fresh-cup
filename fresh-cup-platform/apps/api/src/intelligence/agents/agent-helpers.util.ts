import type { AiInsightDto } from "../dto/ai-insight.dto";

export function toInsightList(...items: (AiInsightDto | AiInsightDto[])[]): AiInsightDto[] {
  return items.flatMap((item) => (Array.isArray(item) ? item : [item]));
}

export function averageConfidence(insights: AiInsightDto[]): number {
  if (insights.length === 0) return 0;
  return insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
}

export function summarizeInsights(insights: AiInsightDto[], limit = 3): string {
  if (insights.length === 0) return "No data available yet for this domain.";
  return insights
    .slice(0, limit)
    .map((insight) => insight.explanation)
    .join(" ");
}
