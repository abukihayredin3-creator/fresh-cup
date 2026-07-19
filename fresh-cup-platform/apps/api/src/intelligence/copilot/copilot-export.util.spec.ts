import type { CopilotResponse } from "./copilot.types";
import { toCsv, toMarkdownBriefing, toSlideOutline } from "./copilot-export.util";

const RESPONSE: CopilotResponse = {
  question: "How was this week?",
  branchId: "b1",
  steps: [
    { step: "collect", label: "Collect", tookMs: 1, summary: "collected" },
    { step: "analyze_compare", label: "Analyze", tookMs: 1, summary: "analyzed" },
  ],
  agentAnswers: [],
  decisionReport: {
    issue: "Sales decline detected",
    metric: "weekly revenue",
    changePercent: -15,
    currentValueEtb: 85000,
    previousValueEtb: 100000,
    reasons: [{ factor: "Low foot traffic", evidence: "orders fell", confidence: 0.6 }],
    recommendations: [
      {
        action: "Launch a coupon",
        expectedImpactEtb: 3000,
        confidence: 0.5,
        requiresApproval: true,
      },
    ],
    totalExpectedImpactEtb: 3000,
    generatedAt: "2026-07-19T00:00:00.000Z",
  },
  forecast: {
    modelKey: "sales-revenue",
    modelVersion: 1,
    prediction: 42000,
    confidence: 0.65,
    topReasons: ["trend"],
    contributingFactors: [],
    suggestedAction: "plan staffing",
  },
  explanation: "Revenue dipped, mainly due to lower foot traffic.",
  recommendations: [{ action: "Launch a coupon", expectedImpactEtb: 3000, confidence: 0.5 }],
  confidence: 0.55,
  generatedAt: "2026-07-19T00:00:00.000Z",
};

describe("copilot-export.util", () => {
  it("toCsv produces a header row plus one row per section", () => {
    const file = toCsv(RESPONSE);
    expect(file.mimeType).toBe("text/csv");
    expect(file.content.split("\n")[0]).toBe("Section,Item,Detail,Confidence");
    expect(file.content).toContain("Recommendation,Launch a coupon,3000,0.50");
  });

  it("toCsv escapes commas in free-text fields", () => {
    const withComma: CopilotResponse = {
      ...RESPONSE,
      explanation: "Revenue dipped, mainly due to rain",
    };
    const file = toCsv(withComma);
    expect(file.content).toContain('"Revenue dipped, mainly due to rain"');
  });

  it("toMarkdownBriefing includes the reasoning trace and recommendations", () => {
    const file = toMarkdownBriefing(RESPONSE);
    expect(file.mimeType).toBe("text/markdown");
    expect(file.content).toContain("# Executive Copilot Briefing");
    expect(file.content).toContain("Launch a coupon");
    expect(file.content).toContain("Low foot traffic");
  });

  it("toSlideOutline builds one slide per major section", () => {
    const slides = toSlideOutline(RESPONSE);
    expect(slides.map((s) => s.title)).toEqual([
      "Executive Copilot Briefing",
      "Summary",
      "Sales decline detected",
      "Forecast",
      "Recommended actions",
    ]);
  });

  it("toSlideOutline omits the decision-report slide when there is none", () => {
    const slides = toSlideOutline({ ...RESPONSE, decisionReport: null });
    expect(slides.map((s) => s.title)).not.toContain("Sales decline detected");
  });
});
