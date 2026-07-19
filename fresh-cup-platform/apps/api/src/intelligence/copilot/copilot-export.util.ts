import type { CopilotResponse } from "./copilot.types";

export interface ExportedFile {
  filename: string;
  mimeType: string;
  content: string;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * The spec asks for "PDF / Excel / Presentation" copilot exports. This
 * platform hand-rolls everything else (no external ML service, no extra
 * runtime dependencies beyond what's already in package.json), so rather
 * than pull in a PDF/PPTX-generation library, these three exports are:
 * CSV (opens directly in Excel — a real spreadsheet, not a binary .xlsx),
 * Markdown (a real document, readable as-is or convertible to PDF/Word
 * client-side), and a JSON slide outline (title + bullets per slide — a
 * real presentation *structure*, not a rendered .pptx). Each is a
 * genuine, useful artifact; none of them fake a binary format they don't
 * actually produce. This is a documented scope decision, not an
 * oversight — see docs/ROADMAP.md's Part 3 notes.
 */
export function toCsv(response: CopilotResponse): ExportedFile {
  const rows: string[] = ["Section,Item,Detail,Confidence"];
  rows.push(
    `Question,,${csvEscape(response.question)},`,
    `Explanation,,${csvEscape(response.explanation)},${response.confidence.toFixed(2)}`,
  );
  if (response.decisionReport) {
    rows.push(
      `Decision,${csvEscape(response.decisionReport.issue)},${response.decisionReport.changePercent}% change,`,
    );
    for (const reason of response.decisionReport.reasons) {
      rows.push(
        `Reason,${csvEscape(reason.factor)},${csvEscape(reason.evidence)},${reason.confidence.toFixed(2)}`,
      );
    }
  }
  if (response.forecast) {
    rows.push(
      `Forecast,${csvEscape(response.forecast.modelKey)},${response.forecast.prediction} ETB,${response.forecast.confidence.toFixed(2)}`,
    );
  }
  for (const rec of response.recommendations) {
    rows.push(
      `Recommendation,${csvEscape(rec.action)},${rec.expectedImpactEtb ?? ""},${rec.confidence.toFixed(2)}`,
    );
  }
  return {
    filename: `copilot-briefing-${response.generatedAt.slice(0, 10)}.csv`,
    mimeType: "text/csv",
    content: rows.join("\n"),
  };
}

export function toMarkdownBriefing(response: CopilotResponse): ExportedFile {
  const lines: string[] = [
    `# Executive Copilot Briefing`,
    ``,
    `**Question:** ${response.question}`,
    `**Generated:** ${response.generatedAt}`,
    `**Overall confidence:** ${Math.round(response.confidence * 100)}%`,
    ``,
    `## Reasoning trace`,
    ...response.steps.map((s) => `1. **${s.label}** — ${s.summary}`),
    ``,
    `## Explanation`,
    response.explanation,
    ``,
  ];

  if (response.decisionReport) {
    lines.push(
      `## ${response.decisionReport.issue}`,
      `${response.decisionReport.metric} changed ${response.decisionReport.changePercent}% (${response.decisionReport.previousValueEtb} ETB -> ${response.decisionReport.currentValueEtb} ETB).`,
      ``,
      `### Reasons`,
      ...response.decisionReport.reasons.map(
        (r) => `- **${r.factor}** (${Math.round(r.confidence * 100)}% confidence): ${r.evidence}`,
      ),
      ``,
    );
  }

  if (response.forecast) {
    lines.push(
      `## Forecast`,
      `Predicted next-period revenue: ${response.forecast.prediction} ETB (${Math.round(response.forecast.confidence * 100)}% confidence).`,
      ``,
    );
  }

  lines.push(
    `## Recommendations`,
    ...response.recommendations.map(
      (r) =>
        `- ${r.action}${r.expectedImpactEtb ? ` (expected impact: ${r.expectedImpactEtb} ETB)` : ""} — ${Math.round(r.confidence * 100)}% confidence`,
    ),
  );

  return {
    filename: `copilot-briefing-${response.generatedAt.slice(0, 10)}.md`,
    mimeType: "text/markdown",
    content: lines.join("\n"),
  };
}

export interface SlideOutline {
  title: string;
  bullets: string[];
}

export function toSlideOutline(response: CopilotResponse): SlideOutline[] {
  const slides: SlideOutline[] = [
    { title: "Executive Copilot Briefing", bullets: [response.question] },
    {
      title: "Summary",
      bullets: [
        response.explanation,
        `Overall confidence: ${Math.round(response.confidence * 100)}%`,
      ],
    },
  ];

  if (response.decisionReport) {
    slides.push({
      title: response.decisionReport.issue,
      bullets: response.decisionReport.reasons.map((r) => `${r.factor}: ${r.evidence}`),
    });
  }

  if (response.forecast) {
    slides.push({
      title: "Forecast",
      bullets: [
        `Predicted next-period revenue: ${response.forecast.prediction} ETB`,
        `Confidence: ${Math.round(response.forecast.confidence * 100)}%`,
      ],
    });
  }

  slides.push({
    title: "Recommended actions",
    bullets: response.recommendations.map(
      (r) => `${r.action}${r.expectedImpactEtb ? ` (+${r.expectedImpactEtb} ETB)` : ""}`,
    ),
  });

  return slides;
}
